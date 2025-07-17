import type { editor } from "monaco-editor";
// import amisSchema from "amis/schema.json";
export default {
    "type": "editor",
    "name": "json_schema",
    "label": "编辑器",
    "language": "json",
    allowFullscreen: true,
    "editorDidMount": (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
        // editor 是 monaco 实例，monaco 是全局的名称空间
        const disposeCompletion = monaco.languages.registerCompletionItemProvider('json', {
            /// 其他细节参考 monaco 手册
        });

        const dispose = () => {
            disposeCompletion.dispose();
            editor.dispose();
        }

        monaco.languages.json.jsonDefaults.setModeConfiguration({
            hovers: true,
            completionItems: true,
        })

        // monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        //     validate: true,
        //     schemas: [{
        //         uri: new URL(
        //             "amis/schema.json",
        //             import.meta.url
        //         ).toString(),
        //         fileMatch: ['*.json'], // Associate with our model
        //         schema: amisSchema
        //     }]
        // });

        return dispose;
    }
}