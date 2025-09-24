import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';
import { DisposableChain } from './helpers/disposable_chain';
import { debounce, once } from './helpers/util';
import { createHiveSqlLanguageService, createHiveSqlActions } from './index';
import { ITableSourceManager } from './types';
import { LanguageIdEnum, registerLanguage, setupLanguageFeatures, vsPlusTheme } from 'monaco-sql-languages';
import 'monaco-sql-languages/esm/languages/hive/hive.contribution';
const envSetup = once(() => {
    // Customize the various tokens style
    editor.defineTheme('sql-dark', vsPlusTheme.darkThemeData);
    editor.defineTheme('sql-light', vsPlusTheme.lightThemeData);
    editor.defineTheme('sql-hc', vsPlusTheme.hcBlackThemeData);
    
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

    const originalMonacoEnvironment = (window as any).MonacoEnvironment;
    const getWorker = (workerId: string, label: string) => {
        if (label === 'hivesql') {
            return new Worker(
                new URL(
                "monaco-sql-languages/esm/languages/hive/hive.worker",
                // @ts-ignore
                import.meta.url
                )
            );
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

});

export function registerHivesqlLs({
    tableSourceManager,
    onCopyToClipboard,
    onValidate,
}: {
    tableSourceManager: ITableSourceManager,
    onCopyToClipboard?: (text: string) => void | Promise<void>,
    onValidate?: (errors: editor.IMarkerData[]) => void,
}) {
    envSetup();
    
    return (editorInstance: monaco.editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
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
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
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


        disposables.add(monaco.languages.registerCodeActionProvider(LanguageIdEnum.HIVE, {
            provideCodeActions(model, range) {
                const context = createHiveSqlLanguageService({ model, tableSourceManager, });
                const ret = context.doProvideCodeActions(range);
                return ret;
            },
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

        createHiveSqlActions({
            tableSourceManager,
            onCopyToClipboard,
        })
            .forEach(action => {
                disposables.add(monaco.editor.registerCommand(action.id, (accessor, ...args) => {
                    action.run(editorInstance, ...args);
                }));
            });

        return disposables;
    };
}
