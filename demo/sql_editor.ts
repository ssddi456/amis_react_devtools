import { editor } from 'monaco-editor';
import { LanguageIdEnum, setupLanguageFeatures, vsPlusTheme } from 'monaco-sql-languages';
import 'monaco-sql-languages/esm/languages/hive/hive.contribution';
import { createHiveSqlLanguageService } from './sql_ls';
import { DisposableChain } from './disposable_chain';
import tableSourceManager from './data/example';

// Customize the various tokens style
editor.defineTheme('sql-dark', vsPlusTheme.darkThemeData);
editor.defineTheme('sql-light', vsPlusTheme.lightThemeData);
editor.defineTheme('sql-hc', vsPlusTheme.hcBlackThemeData);

setupLanguageFeatures(LanguageIdEnum.HIVE, {
    completionItems: true,
    references: true,
    diagnostics: false,
});

const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: ReturnType<typeof setTimeout> | null;
    return (...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
};

const createSqlEditor = (name: string) => ({
    "type": "editor",
    "name": name,
    "label": "编辑器",
    "language": LanguageIdEnum.HIVE,
    allowFullscreen: true,
    "editorDidMount": (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
        monaco.editor.setTheme('sql-light');
        const doValidate = debounce(async () => {
            const model = editorInstance.getModel();
            if (model) {
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
                const errors = await context.doValidation();
                console.log('validation errors', errors);
                monaco.editor.setModelMarkers(model, LanguageIdEnum.HIVE, errors.map(err => {
                    return {
                        severity: monaco.MarkerSeverity.Error,
                        startLineNumber: err.startLineNumber,
                        startColumn: err.startColumn,
                        endLineNumber: err.endLineNumber,
                        endColumn: err.endColumn,
                        message: err.message
                    };
                }));
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
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
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
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
                const ret = context.doDefinition(position);
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerReferenceProvider(LanguageIdEnum.HIVE, {
            provideReferences: (model, position) => {
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
                const ret = context.doReferences(position);
                return ret;
            }
        }));

        disposables.add(monaco.languages.registerDocumentFormattingEditProvider(LanguageIdEnum.HIVE, {
            provideDocumentFormattingEdits: (model, options) => {
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
                const formatted = context.formatHiveSQL(model.getValue());
                return [
                    {
                        range: model.getFullModelRange(),
                        text: formatted,
                    }
                ];
            }
        }));

        return disposables;
    },
})

export default createSqlEditor;