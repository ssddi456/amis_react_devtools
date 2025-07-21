import { editor } from 'monaco-editor';
import { LanguageIdEnum, setupLanguageFeatures, vsPlusTheme } from 'monaco-sql-languages';
import 'monaco-sql-languages/esm/languages/hive/hive.contribution';
import { getHiveType } from './sql_ls';

// Customize the various tokens style
editor.defineTheme('sql-dark', vsPlusTheme.darkThemeData);
editor.defineTheme('sql-light', vsPlusTheme.lightThemeData);
editor.defineTheme('sql-hc', vsPlusTheme.hcBlackThemeData);

setupLanguageFeatures(LanguageIdEnum.HIVE, {
    completionItems: true,
    references: true,
});

export default {
    "type": "editor",
    "name": "hive_sql",
    "label": "编辑器",
    "language": LanguageIdEnum.HIVE,
    allowFullscreen: true,
    "editorDidMount": (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {

        monaco.editor.setTheme('sql-light');
        const doValidate = () => {
            const model = editorInstance.getModel();
            if (model) {
                const context = getHiveType(model);
                const errors = context.doValidation();
                monaco.editor.setModelMarkers(model, LanguageIdEnum.HIVE, errors.map(err => {
                    return {
                        severity: monaco.MarkerSeverity.Error,
                        startLineNumber: err.range.startLineNumber,
                        startColumn: err.range.startColumn,
                        endLineNumber: err.range.endLineNumber,
                        endColumn: err.range.endColumn,
                        message: err.message
                    };
                }));
            }
        }
        editorInstance.onDidChangeModelContent((e) => {
            doValidate();
        });

        doValidate();

        console.log(editorInstance.getOptions());

        monaco.languages.registerCompletionItemProvider(LanguageIdEnum.HIVE, {
            triggerCharacters: ['.', '"', ' '],
            provideCompletionItems: (model, position) => {
                const context = getHiveType(model);
                return context.doComplete(position);
            }
        });

        monaco.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
            provideHover: (model, position) => {
                const context = getHiveType(model);
                return context.doHover(position);
            }
        });

    },
}
