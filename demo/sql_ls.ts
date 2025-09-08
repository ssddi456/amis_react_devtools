import { editor, languages, Position, Uri, MarkerSeverity } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { HiveSQL, } from 'dt-sql-parser';
import { posInRange, WithSource } from "./ls_helper";
import {
    ProgramContext, 
    TableSourceContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ContextManager, createContextManager } from "./context_manager";
import { printNode, rangeFromNode, sliceToRange, findTokenAtPosition, printNodeTree, ITableSourceManager } from "./sql_ls_helper";
import { matchType } from "./sql_tree_query";
import { formatHiveSQL } from './formatter';
import { getAllEntityInfoFromNode, getEntityInfoAtPosition } from "./getTableAndColumnInfoAtPosition";
import { formatHoverRes, tableInfoFromNode, formatDefinitionRes, getIdentifierReferences } from "./formatHoverRes";
import tableSourceManager from "./data/example";

interface ContextInfos {
    hiveSqlParse: HiveSQL;
    sqlSlices: ReturnType<HiveSQL['splitSQLByStatement']>;
    tree: ProgramContext;
    contextManager: ContextManager;
}

const contextCache = new Map<string, ContextInfos>();

function getContextWithCache(text: string, noCache: boolean, tableSourceManager?: ITableSourceManager): ContextInfos {
    if (contextCache.has(text) && !noCache) {
        return contextCache.get(text)!;
    }
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(text);
    const ctx = hiveSqlParse.createParser(text);
    const tree = ctx.program();
    const contextManager = createContextManager(tree, tableSourceManager);
    const ret: ContextInfos = {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    };
    contextCache.set(text, ret);
    return ret;
}

// 这里列一下表
// hive is from
// https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4
// https://raw.githubusercontent.com/DTStack/dt-sql-parser/refs/heads/main/src/grammar/hive/HiveSqlParser.g4
export const createHiveLs = ({
    model,
    tableSourceManager,
    isTest = false,
    noCache = false
}: {
    model: {
        uri: { toString: () => string; };
        getValue: () => string;
    },
    tableSourceManager?: ITableSourceManager
    isTest?: boolean,
    noCache?: boolean,
}) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    } = getContextWithCache(document.getText(), noCache, tableSourceManager);

    const logSource = (arg: any) => {
        if (arg && '__source' in arg) {
            const source = arg.__source;
            console.log(`vscode://file/${source.fileName}:${source.lineNumber}:${source.columnNumber}`);
        }
    };
    const logger: (...args: any[]) => void = isTest ? console.log : () => { };

    logger('getCtxFromPos foundNode', contextManager.toString());

    const getCtxFromPos = (position: Position) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return null;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                const symbolAndContext = contextManager.getSymbolByPosition(position);
                if (symbolAndContext) {
                    return symbolAndContext;
                }

                const context = contextManager.getContextByPosition(position);
                const foundNode = findTokenAtPosition(position, tree);
                const mrScope = context?.getMrScope()?.getScopeByPosition(position) || null;

                logger('getCtxFromPos mrScope', '-->', mrScope, '<--');
                return {
                    foundNode,
                    context,
                    mrScope,
                };
            }
        }
        return null;
    };

    return {
        doHover: async (
            position: Position,
            isTest?: boolean
        ) => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            const hoverInfo = await getEntityInfoAtPosition(foundNode, mrScope, context, isTest);
            logger('getTableAndColumnInfoAtPosition', hoverInfo);
            logSource(hoverInfo);
            if (!hoverInfo) {
                return;
            }

            return formatHoverRes(hoverInfo);
        },

        doSyntaxHover: (
            position: Position,
        ): languages.Hover | undefined => {
            const { foundNode, context } = getCtxFromPos(position) || {};
            if (!foundNode) {
                return;
            }
            const text = printNodeTree(foundNode, '\n\n');
            const range = rangeFromNode(foundNode);

            return {
                contents: [{ value: text }],
                range
            };
        },

        async doValidation(): Promise<WithSource<editor.IMarkerData>[]> {
            const validations: WithSource<editor.IMarkerData>[] = [];

            const SyntaxErrors = hiveSqlParse.validate(document.getText());
            SyntaxErrors.forEach(err => {
                validations.push({
                    severity: MarkerSeverity.Error,
                    ...sliceToRange(err),
                    message: err.message
                })
            });

            contextManager.rootContext?.referenceNotFound.forEach(refs => {
                if (
                    !(refs[0] instanceof TableSourceContext) ||
                    !tableInfoFromNode(refs[0], contextManager.rootContext!)
                ) {
                    refs.forEach(ref => {
                        validations.push({
                            severity: MarkerSeverity.Error,
                            ...rangeFromNode(ref),
                            message: `Reference not found: ${ref.getText()}`,
                        });
                    });
                }
            });

            const errors = contextManager.rootContext?.validate() || [];
            errors.forEach(err => {
                validations.push({
                    ...err,
                    severity: MarkerSeverity.Error,
                    ...rangeFromNode(err.context),
                    message: err.message
                })
            });

            const symbols = contextManager.getSymbolsAndContext() || [];
            await Promise.all(symbols.map(async ({ range, mrScope, context }, i) => {
                // console.log('doValidation foundNode', range.context?.getText());
                // const foundNodeText = range.context?.getText() || '';
                // if (foundNodeText == 'rpr_test_news_record_da') {
                //     debugger;
                // }
                const hoverInfo = await getAllEntityInfoFromNode(range.context, context, mrScope, isTest);
                if (!hoverInfo) {
                    validations.push({
                        type: 'no_hover_info',
                        severity: MarkerSeverity.Error,
                        startLineNumber: range.lineNumber,
                        startColumn: range.column,
                        endLineNumber: range.lineNumber,
                        endColumn: range.column + (range.end - range.start),
                        message: `Reference not found: ${printNode(range.context)}`,
                    });
                    return;
                }

                if (
                    hoverInfo.type == 'unknown'
                    || hoverInfo.type == 'noTable'
                    || hoverInfo.type == 'noColumn'
                ) {
                    const res = formatHoverRes(hoverInfo);
                    validations.push({
                        ...res,
                        severity: MarkerSeverity.Error,
                        ...rangeFromNode(range.context),
                        message: res.contents[0].value,
                    });
                }
            }));
            return validations;
        },

        doDefinition: async (
            position: Position,
            isTest?: boolean
        ) => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};

            const hoverInfo = await getEntityInfoAtPosition(foundNode, mrScope, context, isTest);
            if (!hoverInfo) {
                return;
            }

            return formatDefinitionRes(model.uri as Uri, hoverInfo);
        },

        doReferences(
            position: Position,
            isTest?: boolean
        ): WithSource<languages.Location[]> | undefined {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
            )) {
                return;
            }

            const references = getIdentifierReferences(foundNode, mrScope, context);
            if (!references || references.length === 0) {
                return;
            }

            return references.map(ref => ({
                uri: model.uri as Uri,
                range: rangeFromNode(ref),
            }));
        },
        formatHiveSQL(sql: string): string {
            const formatted = formatHiveSQL(sql);
            return formatted;
        },
        getContextManager: () => {
            return contextManager
        },
    };
}
