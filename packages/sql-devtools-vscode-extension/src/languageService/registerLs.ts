import * as vscode from 'vscode';
import { LanguageIdEnum } from '@amis-devtools/sql-language-service/src/consts';
import { createHiveSqlLanguageService, createHiveSqlActions } from '@amis-devtools/sql-language-service/src/';
import { customActionRunHandler, ITableSourceManager } from "@amis-devtools/sql-language-service/src/types";
import { debounce } from '@amis-devtools/sql-language-service/src/helpers/util';
import { DisposableChain } from '@amis-devtools/sql-language-service/src/helpers/disposable_chain';
import { CancellationToken, FormattingOptions, MarkdownString, TextDocument } from 'vscode';
import { positionToPos, posRangeToRange, rangeToPosRange } from '../helper/pos';
import { Pos } from '@amis-devtools/sql-language-service/src/helpers/pos';

export function registerHivesqlLs({
    tableSourceManager,
    onCopyToClipboard,
    customActions = [],
    context: vsContext,
}: {
    tableSourceManager: ITableSourceManager,
    onCopyToClipboard?: (text: string) => void | Promise<void>,
    customActions?: {
        id: string;
        title: string;
        run: customActionRunHandler
    }[],
    context: vscode.ExtensionContext,
}) {

    const createLs = (model: vscode.TextDocument) =>
        createHiveSqlLanguageService({
            model: {
                getValue: () => model.getText(),
                uri: model.uri.toString()
            }, tableSourceManager, customActions
        });


    const diagnosticCollection = vscode.languages.createDiagnosticCollection('hivesql');
    const doValidate = debounce(async (document: vscode.TextDocument) => {
        const model = document;
        if (model) {
            if (model.languageId !== LanguageIdEnum.HIVE) {
                diagnosticCollection.set(model.uri, []);
                return;
            }
            const context = createLs(model);
            const errors = await context.doValidation();
            console.log('validation errors', errors);

            const markers = errors.map<vscode.Diagnostic>(err => {
                return {
                    severity: vscode.DiagnosticSeverity.Error,
                    range: new vscode.Range(
                        new vscode.Position(err.startLineNumber, err.startColumn),
                        new vscode.Position(err.endLineNumber, err.endColumn)
                    ),
                    message: err.message
                };
            });

            diagnosticCollection.set(model.uri, markers);
        }
    }, 300);

    const disposables = new DisposableChain();

    disposables.add(vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === vsContext.workspaceState.get<vscode.TextDocument>('currentModel')) {
            doValidate(e.document);
        }
    }));

    disposables.add(vscode.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
        provideHover: async (model, position): Promise<vscode.Hover | undefined> => {
            const context = createLs(model);
            const hoverRes = await context.doHover(positionToPos(position));
            if (!hoverRes) {
                return;
            }
            return {
                contents: hoverRes.contents.map(c => new MarkdownString(c.value)),
                range: posRangeToRange(hoverRes.range!)
            }
        }
    }));

    disposables.add(vscode.languages.registerDefinitionProvider(LanguageIdEnum.HIVE, {
        provideDefinition: async (model, position): Promise<vscode.Definition | undefined> => {
            const context = createLs(model);
            const definitionRes = await context.doDefinition(positionToPos(position));
            if (!definitionRes) {
                return;
            }
            if (Array.isArray(definitionRes)) {
                return definitionRes.map(res => ({
                    uri: res.uri,
                    range: posRangeToRange(res.range)
                }));
            }
            return  {
                uri: definitionRes.uri,
                range: posRangeToRange(definitionRes.range)
            }
        }
    }));

    disposables.add(vscode.languages.registerReferenceProvider(LanguageIdEnum.HIVE, {
        provideReferences: async (model, position) => {
            const context = createLs(model);
            const references = context.doReferences(positionToPos(position));
            return references?.map(ref => 
                new vscode.Location(ref.uri, posRangeToRange(ref.range))
            );
        }
    }));

    disposables.add(vscode.languages.registerCodeActionsProvider(LanguageIdEnum.HIVE, {
        provideCodeActions: (model, range) => {
            const context = createLs(model);
            const codeActions = context.doProvideCodeActions(rangeToPosRange(range));
            return codeActions.actions.map(action => ({
                title: action.title,
                command: action.command!.id,
            }));
        },
    }));

    disposables.add(vscode.languages.registerDocumentFormattingEditProvider(LanguageIdEnum.HIVE, {
        provideDocumentFormattingEdits: (document: TextDocument, options: FormattingOptions, token: CancellationToken) => {
            const context = createLs(document);
            const formatted = context.formatHiveSQL(document.getText());
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            return [
                vscode.TextEdit.replace(fullRange, formatted)
            ];
        }
    }));

    createHiveSqlActions({
        tableSourceManager,
        onCopyToClipboard,
        customActions,
    })
        .forEach(action => {
            disposables.add(vscode.commands.registerCommand(action.id, (pos: Pos) => {
                const textEditor = vscode.window.activeTextEditor?.document;
                const text = textEditor ? textEditor.getText() : '';
                const position = vscode.window.activeTextEditor?.selection.active;
                if (!textEditor || !position) {
                    return;
                }
                action.run({
                    getValue: () => text,
                    getPosition: () => positionToPos(position),
                }, pos);
            }));
        });

    return disposables;
}