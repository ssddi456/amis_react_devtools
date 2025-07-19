import type { editor } from "monaco-editor";
const amisSchema = require("amis/schema.json");

console.log('amisSchema.definitions', amisSchema.definitions);

const {
    RootSchema,
    ...anyOtherSchema
} = amisSchema.definitions;

const amisSchemaAny =  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    anyOf: {
        ...anyOtherSchema
    }
}

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
            provideCompletionItems: (model, position) => {
                console.log("provideCompletionItems", model, position);
                const word = model.getWordUntilPosition(position);
                // get schema from amis
                // check if in object
                
                return {
                    suggestions: [
                        {
                            label: 'amis',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'amis',
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: word.endColumn
                            }
                        }
                    ]
                };
            }
        });
        monaco.languages.json.jsonDefaults.setModeConfiguration({
            colors: true,
            hovers: true,
            completionItems: true,
            foldingRanges: true,
            diagnostics: true,
        })

        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            enableSchemaRequest: true,
            validate: true,
            schemas: [{
                uri: "http://myserver/foo-schema.json",
                fileMatch: ["*"],
                schema: amisSchemaAny
            }]
        });

        return () => {
            completionDispose.dispose();
        }
    }
}