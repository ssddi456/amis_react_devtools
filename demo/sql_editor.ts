import { editor, Position } from 'monaco-editor';
import { LanguageIdEnum, setupLanguageFeatures, vsPlusTheme } from 'monaco-sql-languages';
import 'monaco-sql-languages/esm/languages/hive/hive.contribution';
import { createHiveLs } from './sql_ls';
import { DisposableChain, posFromString, stringFromPos } from './ls_helper';

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
                const context = createHiveLs(model);
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

        const disposables = new DisposableChain();

        disposables.add(editorInstance.onDidChangeModelContent((e) => {
            doValidate();

        }));

        doValidate();

        disposables.add(monaco.languages.registerCompletionItemProvider(LanguageIdEnum.HIVE, {
            triggerCharacters: ['.', '"', ' '],
            provideCompletionItems: (model, position) => {
                const context = createHiveLs(model);
                const ret = context.doComplete(position) as undefined;
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
            provideHover: (model, position) => {
                const context = createHiveLs(model);
                const ret = context.doHover(position);
                console.log('hover result', stringFromPos(position), ret);
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerHoverProvider(LanguageIdEnum.HIVE, {
            provideHover: (model, position) => {
                return;
                const context = createHiveLs(model);
                const ret = context.doSyntaxHover(position);
                console.log('hover syntax result', stringFromPos(position), ret);
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerDefinitionProvider(LanguageIdEnum.HIVE, {
            provideDefinition: (model, position) => {
                const context = createHiveLs(model);
                const ret = context.doDefinition(position);
                console.log('definition result', stringFromPos(position), model.uri, ret);
                return ret;
            }
        }));
        
        disposables.add(monaco.languages.registerReferenceProvider(LanguageIdEnum.HIVE, {
            provideReferences: (model, position) => {
                const context = createHiveLs(model);
                const ret = context.doReferences(position);
                console.log('references result', stringFromPos(position), model.uri, ret);
                return ret;
            }
        }));

        return disposables;
    },
}
