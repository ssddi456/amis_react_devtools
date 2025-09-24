import { DisposableChain } from "@amis-devtools/sql-language-service/src/helpers/disposable_chain";
import { Pos } from "@amis-devtools/sql-language-service/src/helpers/pos";
import {
    toCompletionItemKind,
    isInsertReplaceEdit,
    toTextEdit,
    toMarkedStringArray,
} from "@amis-devtools/sql-devtools-ui/src/amis_json_ls";

import { editor, languages } from "monaco-editor";
import { getLanguageService, TextDocument } from 'vscode-json-languageservice';
import { once } from "@amis-devtools/sql-language-service/src/helpers/util";


const hiveTableInfoItemSchema ={
    type: 'object',
    properties: {
        db_name: {
            type: 'string',
            description: 'Database name'
        },
        table_name: {
            type: 'string',
            description: 'Table name'
        },
        table_id: {
            type: 'number',
            description: 'Unique identifier for the table'
        },
        description: {
            type: 'string',
            description: 'Description of the table'
        },
        column_list: {
            type: 'array',
            description: 'List of columns in the table',
            items: {
                type: 'object',
                properties: {
                    column_name: {
                        type: 'string',
                        description: 'Column name'
                    },
                    data_type_string: {
                        type: 'string',
                        description: 'Data type of the column'
                    },
                    description: {
                        type: 'string',
                        description: 'Comment about the column'
                    }
                },
                required: ['column_name', 'data_type_string']
            }
        }
    },
    required: ['db_name', 'table_name',  'column_list']
};

const hiveTableInfoSchema = {
    type: 'array',
    description: 'List of Hive table information',
    items: hiveTableInfoItemSchema
}

export function toRange(position: {
    start: {
        line: number;
        character: number;
    };
    end: {
        line: number;
        character: number;
    };
}) {
    return {
        startLineNumber: position.start.line + 1,
        startColumn: position.start.character + 1,
        endLineNumber: position.end.line + 1,
        endColumn: position.end.character + 1
    };
};

export function posToPosition(position: {
    lineNumber: number;
    column: number;
}) {
    return {
        line: position.lineNumber - 1,
        character: position.column - 1
    };
}

export const getJSONLs = (model: editor.ITextModel) => {
    const jsonls = getLanguageService({
        schemaRequestService: () => Promise.resolve(JSON.stringify(hiveTableInfoSchema))
    });

    const document = TextDocument.create(model.uri.toString(), 'json', 0, model.getValue());
    const jsonDocument = jsonls.parseJSONDocument(document);

    jsonls.configure({
        validate: true,
        allowComments: true,
        schemas: [
            {
                uri: 'https://test.hive.com/schema.json',
                fileMatch: ['*'],
                schema: hiveTableInfoSchema
            }
        ]
    });

    return {
        doComplete: (position: Pos) => {
            return jsonls.doComplete(document, posToPosition(position), jsonDocument);
        },
        doHover: (position: Pos) => {
            return jsonls.doHover(document, posToPosition(position), jsonDocument);
        },
    };
}

const setupEnv = once(() => {
    const originalMonacoEnvironment = (window as any).MonacoEnvironment;
    const getWorker = (workerId: string, label: string) => {
        console.log('getWorker', workerId, label);

        if (label === 'json') {
            // @ts-ignore
            return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url));
        }
        return null;
    }

    if (!originalMonacoEnvironment) {
        (window as any).MonacoEnvironment = {
            getWorker
        };
    } else if (!originalMonacoEnvironment.getWorker) {
        (window as any).MonacoEnvironment.getWorker = getWorker;
    } else {
        const originalGetWorker = originalMonacoEnvironment.getWorker;
        (window as any).MonacoEnvironment.getWorker = (workerId: string, label: string) => {
            const currRet = getWorker(workerId, label);
            if (currRet) {
                return currRet;
            }
            return originalGetWorker(workerId, label);
        };
    }
})


const languageId = 'json';

export const registerJsonLs = () => {
    setupEnv();

    return (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
        const disposables = new DisposableChain();

        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: false, // Disable JSON schema validation
            enableSchemaRequest: false // Disable fetching schemas
        });
        
        // editor 是 monaco 实例，monaco 是全局的名称空间
        disposables.add(monaco.languages.registerCompletionItemProvider(languageId, {
            triggerCharacters: ['.', '"'],
            provideCompletionItems: async (model, position) => {
                console.log("provideCompletionItems", model, position);
                const word = model.getWordUntilPosition(position);

                const completion = await getJSONLs(model).doComplete(position);
                if (!completion) {
                    return;
                }
                console.log("completion", completion);
                const wordRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: word.endColumn
                }

                const items: languages.CompletionItem[] = completion.items.map((entry: any) => {
                    const item: languages.CompletionItem = {
                        label: entry.label,
                        insertText: entry.insertText || entry.label,
                        sortText: entry.sortText,
                        filterText: entry.filterText,
                        documentation: entry.documentation,
                        detail: entry.detail,
                        // command: toCommand(entry.command),
                        command: undefined,
                        range: wordRange,
                        kind: toCompletionItemKind(entry.kind)
                    };
                    if (entry.textEdit) {
                        if (isInsertReplaceEdit(entry.textEdit)) {
                            item.range = {
                                insert: toRange(entry.textEdit.insert),
                                replace: toRange(entry.textEdit.replace)
                            };
                        } else {
                            item.range = toRange(entry.textEdit.range);
                        }
                        item.insertText = entry.textEdit.newText;
                    }
                    if (entry.additionalTextEdits) {
                        item.additionalTextEdits =
                            entry.additionalTextEdits.map(toTextEdit);
                    }
                    if (entry.insertTextFormat === 2) {
                        item.insertTextRules = languages.CompletionItemInsertTextRule.InsertAsSnippet;
                    }
                    return item;
                });

                return {
                    isIncomplete: completion.isIncomplete,
                    suggestions: items
                };
            }
        }));

        disposables.add(monaco.languages.registerHoverProvider(languageId, {
            provideHover: async (model, position) => {
                console.log("provideHover", model, position);
                const hover = await getJSONLs(model).doHover(position);

                console.log("hover", hover);
                
                if (!hover) {
                    return;
                }
                const contents = toMarkedStringArray(hover.contents || []);
                console.log("hover contents", contents);
                if (!contents || contents.length === 0) {
                    return;
                }
                const range = toRange(hover.range!);
                console.log("hover range", range);
                return {
                    contents,
                    range
                };
            },
        }));


        // Clean up on dispose
        editorInstance.onDidDispose(() => {
            disposables.dispose();
        });
    };
};