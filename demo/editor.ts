import { languages, type editor, } from "monaco-editor";
import { getJSONType, toCompletionItemKind, isInsertReplaceEdit, toRange, toTextEdit, toMarkedStringArray } from "./amis_json_ls";


export default {
    "type": "editor",
    "name": "json_schema",
    "label": "编辑器",
    "language": "json",
    allowFullscreen: true,
    "editorDidMount": (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {

        console.log("editorDidMount", editor, monaco);
        
        // editor 是 monaco 实例，monaco 是全局的名称空间
        const completionDispose = monaco.languages.registerCompletionItemProvider('json', {
            triggerCharacters: ['.', '"'],
            provideCompletionItems: async (model, position) => {
                console.log("provideCompletionItems", model, position);
                const word = model.getWordUntilPosition(position);

                const completion = await getJSONType(model).doComplete(position);
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
        });

        const hoverDispose = monaco.languages.registerHoverProvider('json', {
            provideHover: async (model, position) => {
                console.log("provideHover", model, position);
                const word = model.getWordUntilPosition(position);


                const hover = await getJSONType(model).doHover(position);

                console.log("hover", hover);
                
                if (!hover) {
                    return;
                }
                return {
                    contents: toMarkedStringArray(hover.contents) || [],
                    range: toRange(hover.range)
                };
            },
        });

        

        return () => {
            completionDispose.dispose();
        }
    }
}