import { languages, type editor, } from "monaco-editor";
import { getJSONType, toCompletionItemKind, isInsertReplaceEdit, toTextEdit, toMarkedStringArray } from "./amis_json_ls";
import { toRange } from "./ls_helper";
// replace with newer monaco-editor
const languageId = 'json';
export default {
    "type": "container",
    "name": "json_schema",
    "label": "编辑器",
    "language": languageId,
    "schemas": [{}],
    allowFullscreen: true,
    "editorDidMount": (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {

        console.log("editorDidMount", editor, monaco);

        // editor 是 monaco 实例，monaco 是全局的名称空间
        const completionDispose = monaco.languages.registerCompletionItemProvider(languageId, {
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

        const hoverDispose = monaco.languages.registerHoverProvider(languageId, {
            provideHover: async (model, position) => {
                console.log("provideHover", model, position);
                const hover = await getJSONType(model).doHover(position);

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
        });

        

        return () => {
            completionDispose.dispose();
            hoverDispose.dispose();
        }
    }
}