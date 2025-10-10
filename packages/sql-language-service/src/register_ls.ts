import type { editor } from 'monaco-editor';
import { DisposableChain } from './helpers/disposable_chain';
import { debounce, once } from './helpers/util';
import { createHiveSqlLanguageService, createHiveSqlActions } from './index';
import { customActionRunHandler, ITableSourceManager } from './types';
import { LanguageIdEnum, registerLanguage, setupLanguageFeatures, vsPlusTheme } from 'monaco-sql-languages';
import { Pos } from './helpers/pos';

export const envSetup = once(() => {    
    registerLanguage({
        id: LanguageIdEnum.HIVE,
        extensions: ['.hivesql'],
        aliases: ['HiveSQL', 'hive', 'Hive'],
        loader: () => import('monaco-sql-languages/esm/languages/hive/hive')
    });
    setupLanguageFeatures(LanguageIdEnum.HIVE, {
        completionItems: true,
        references: false,
        diagnostics: false,
        definitions: false,
    });
});

export function registerHivesqlLs({
    tableSourceManager,
    onCopyToClipboard,
    onValidate,
    customActions = [],
}: {
    tableSourceManager: ITableSourceManager,
    onCopyToClipboard?: (text: string) => void | Promise<void>,
    onValidate?: (errors: editor.IMarkerData[]) => void,
    customActions?: {
        id: string;
        title: string;
        run: customActionRunHandler
    }[]
}) {

    const createLs = (model: editor.ITextModel) => 
        createHiveSqlLanguageService({ model, tableSourceManager, customActions })

    return (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
        monaco.editor.defineTheme('sql-dark', vsPlusTheme.darkThemeData);
        monaco.editor.defineTheme('sql-light', vsPlusTheme.lightThemeData);
        monaco.editor.defineTheme('sql-hc', vsPlusTheme.hcBlackThemeData);
        monaco.editor.setTheme('sql-light');
    
        const doValidate = debounce(async () => {
            const model = editorInstance.getModel();
            if (model) {
                if (model.getLanguageId() !== LanguageIdEnum.HIVE) {
                    // Clear previous markers
                    monaco.editor.setModelMarkers(model, LanguageIdEnum.HIVE, []);
                    // Call the onValidate callback if provided
                    onValidate?.([]);
                    return;
                }
                const context = createLs(model)
                const errors = await context.doValidation();
                console.log('validation errors', errors);
                
                const markers = errors.map(err => {
                    return {
                        severity: monaco.MarkerSeverity.Error,
                        startLineNumber: err.startLineNumber,
                        startColumn: err.startColumn,
                        endLineNumber: err.endLineNumber,
                        endColumn: err.endColumn,
                        message: err.message
                    };
                });
                
                monaco.editor.setModelMarkers(model, LanguageIdEnum.HIVE, markers);
                
                // Call the onValidate callback if provided
                onValidate?.(errors);
            }
        }, 300);

        const disposables = new DisposableChain();

        disposables.add(editorInstance.onDidChangeModelContent((e) => {
            doValidate();
        }));

        disposables.add(editorInstance.onDidChangeModelLanguage((e) => {
            doValidate();
        }));
        disposables.add(editorInstance.onDidChangeModelLanguageConfiguration((e) => {
            doValidate();
        }));
        disposables.add(editorInstance.onDidChangeModelOptions((e) => {
            doValidate();
        }));
        disposables.add(editorInstance.onDidChangeConfiguration((e) => {
            doValidate();
        }));
        disposables.add(editorInstance.onDidChangeModel((e) => {
            doValidate();
        }));


        // disposables.add(editor.onDidChangeMarkers((e) => {
        //     const markers = monaco.editor.getModelMarkers({ owner: LanguageIdEnum.HIVE });
        //     if (markers.length === 0) {
        //         debugger;
        //     }
        //     console.log('markers changed', e, editorInstance.getModel());
        //     console.log('markers changed', markers);
        // }))
        // disposables.add(monaco.languages.registerCompletionItemProvider(LanguageIdEnum.HIVE, {
        //     triggerCharacters: ['.', '"', ' '],
        //     provideCompletionItems: (model, position) => {
        //         const context = createHiveLs({ model, tableSourceManager, });
        //         const ret = context.doComplete(position) as undefined;
        //         return ret;
        //     }
        // }));
        disposables.add(monaco.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
            provideHover: (model, position) => {
                const context = createLs(model)
                const ret = context.doHover(position);
                return ret;
            }
        }));

        // disposables.add(monaco.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
        //     provideHover: (model, position) => {
        //         const context = createHiveLs({ model, tableSourceManager, });
        //         const ret = context.doSyntaxHover(position);
        //         console.log('hover syntax result', stringFromPos(position), ret);
        //         return ret;
        //     }
        // }));
        disposables.add(monaco.languages.registerDefinitionProvider(LanguageIdEnum.HIVE, {
            provideDefinition: (model, position) => {
                const context = createLs(model)
                const ret = context.doDefinition(position);
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerReferenceProvider(LanguageIdEnum.HIVE, {
            provideReferences: (model, position) => {
                const context = createLs(model)
                const ret = context.doReferences(position);
                return ret;
            }
        }));


        disposables.add(monaco.languages.registerCodeActionProvider(LanguageIdEnum.HIVE, {
            provideCodeActions(model, range) {
                const context = createLs(model)
                const ret = context.doProvideCodeActions(range);
                return ret;
            },
        }));

        disposables.add(monaco.languages.registerDocumentFormattingEditProvider(LanguageIdEnum.HIVE, {
            provideDocumentFormattingEdits: (model, options) => {
                const context = createLs(model)
                const formatted = context.formatHiveSQL(model.getValue());
                return [
                    {
                        range: model.getFullModelRange(),
                        text: formatted,
                    }
                ];
            }
        }));

        createHiveSqlActions({
            tableSourceManager,
            onCopyToClipboard,
            customActions,
        })
            .forEach(action => {
                disposables.add(monaco.editor.registerCommand(action.id, (accessor, ...args) => {
                    action.run(editorInstance, args?.[0] as Pos);
                }));
            });

        return disposables;
    };
}
