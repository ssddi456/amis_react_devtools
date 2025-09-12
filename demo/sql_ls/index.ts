import { editor, languages, Position, Uri, MarkerSeverity } from "monaco-editor";
import { HiveSQL, } from 'dt-sql-parser';
import {
    ProgramContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ContextManager, createContextManager } from "./context_manager";
import { rangeFromNode, sliceToRange, findTokenAtPosition } from "./helpers/table_and_column";
import { ITableSourceManager } from "./types";
import { logSource, printNode, printNodeTree } from "./helpers/log";
import { formatHiveSQL } from '../formatter';
import { getAllEntityInfoFromNode, getEntityInfoAtPosition } from "./helpers/getTableAndColumnInfoAtPosition";
import { formatHoverRes, formatDefinitionRes } from "./formatHoverRes";
import { getIdentifierReferences } from "./helpers/getIdentifierReferences";
import { posInRange, WithSource } from "./util";

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
export const createHiveSqlLanguageService = ({
    model,
    tableSourceManager,
    isTest = false,
    noCache = false
}: {
    model: {
        getValue: () => string;
        uri: { toString: () => string; }
    },
    tableSourceManager?: ITableSourceManager
    isTest?: boolean,
    noCache?: boolean,
}) => {
    const text = model.getValue();
    const {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    } = getContextWithCache(text, noCache, tableSourceManager);


    const logger: (...args: any[]) => void = isTest ? console.log : () => { };

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
                logger('foundNode', printNodeTree(foundNode));
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
            console.group('doHover');
            const hoverInfo = await getEntityInfoAtPosition(foundNode, mrScope, context, isTest);
            logger('getTableAndColumnInfoAtPosition', hoverInfo);
            console.groupEnd();
            logSource(hoverInfo);
            if (!hoverInfo) {
                return;
            }

            return formatHoverRes(hoverInfo, true);
        },

        doSyntaxHover: (
            position: Position,
        ): languages.Hover | undefined => {
            const { foundNode } = getCtxFromPos(position) || {};
            if (!foundNode) {
                return;
            }
            const text = printNodeTree(foundNode, '\n');
            const range = rangeFromNode(foundNode);

            return {
                contents: [{ value: text }],
                range
            };
        },

        async doValidation(): Promise<WithSource<editor.IMarkerData>[]> {
            const validations: WithSource<editor.IMarkerData>[] = [];

            const SyntaxErrors = hiveSqlParse.validate(text);
            SyntaxErrors.forEach(err => {
                validations.push({
                    severity: MarkerSeverity.Error,
                    ...sliceToRange(err),
                    message: err.message
                })
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
                    const res = formatHoverRes(hoverInfo)!;
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
        ): WithSource<languages.Location[]> | undefined {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context) {
                return;
            }
            console.group('doReferences');
            console.log('mrScope', mrScope);
            const references = getIdentifierReferences(foundNode, mrScope, context);
            console.groupEnd();
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
