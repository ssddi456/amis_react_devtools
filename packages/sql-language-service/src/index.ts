import type { editor, languages, Uri, MarkerSeverity, IRange } from "monaco-editor";
import { HiveSQL, TextSlice, } from 'dt-sql-parser';
import {
    ProgramContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ContextManager, createContextManager } from "./context_manager";
import { findTokenAtPosition } from "./helpers/table_and_column";
import { Pos, posFromRange, posInRange, rangeFromNode, sliceToRange } from "./helpers/pos";
import { createLogger, printNodeTree } from "./helpers/log";
import { formatHiveSQL } from './formatter';
import { getEntityInfoAtPosition } from "./helpers/getTableAndColumnInfoAtPosition";
import { formatHoverRes, formatDefinitionRes } from "./formatHoverRes";
import { getIdentifierReferences } from "./helpers/getIdentifierReferences";
import { WithSource } from "./helpers/util";
import { matchSubPath } from "./helpers/tree_query";
import { getFormattedSqlFromNode } from "./helpers/formater";
import { CommandId, CommandLabel } from "./consts";
import type { customActionRunHandler, ITableSourceManager } from "./types";

interface ContextInfos {
    hiveSqlParse: HiveSQL;
    sqlSlices: ReturnType<HiveSQL['splitSQLByStatement']>;
    tree: ProgramContext;
    contextManager: ContextManager;
}

const contextCache = new Map<string, ContextInfos>();

export function getContextWithCache(text: string, noCache: boolean, tableSourceManager?: ITableSourceManager): ContextInfos {
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
    noCache = false,
    customActions = []
}: {
    model: {
        getValue: () => string;
        uri: { toString: () => string; }
    },
    tableSourceManager?: ITableSourceManager
    isTest?: boolean,
    noCache?: boolean,
    customActions?: {
        title: string;
        id: string;
    }[]
}) => {
    const text = model.getValue();
    const {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    } = getContextWithCache(text, noCache, tableSourceManager);


    const logger = createLogger('SQL Language Service', isTest);

    const getCtxFromPos = createGetCtxFromPos(sqlSlices, contextManager, tree, logger.log);

    return {
        doComplete: (position: Pos): languages.CompletionList | undefined => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            console.group('doComplete');
            logger.log('foundNode', foundNode);
            logger.log('mrScope', mrScope);
            logger.log('context', context);
            console.groupEnd();
            if (!foundNode || !context) {
                return;
            }
            const completions = contextManager.getCompletions(foundNode, mrScope, context);
            if (!completions || completions.length === 0) {
                return;
            }

            logger.log('completions', completions);

            return {
                incomplete: false,
                suggestions: completions.map<languages.CompletionItem>(item => ({
                    label: item.label,
                    kind: item.kind,
                    detail: item.detail,
                    documentation: item.documentation,
                    insertText: item.insertText,
                    range: rangeFromNode(foundNode),
                }))
            };
        },
        doHover: async (
            position: Pos,
            isTest?: boolean
        ) => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            console.group('doHover');
            const hoverInfo = await getEntityInfoAtPosition(foundNode, mrScope, context, isTest);
            logger.log('getTableAndColumnInfoAtPosition', hoverInfo);
            console.groupEnd();
            if (!hoverInfo) {
                return;
            }

            logger.logSource(hoverInfo);

            return formatHoverRes(hoverInfo, true);
        },

        doSyntaxHover: (
            position: Pos,
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
                    severity: 8 as MarkerSeverity.Error,
                    ...sliceToRange(err),
                    message: err.message
                })
            });

            const errors = await contextManager.validate(isTest) || [];
            errors.forEach(err => {
                validations.push({
                    ...err,
                    severity: 8 as MarkerSeverity.Error,
                    ...rangeFromNode(err.context),
                    message: err.message
                })
            });

            return validations;
        },

        doDefinition: async (
            position: Pos,
            isTest?: boolean
        ) => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};

            const hoverInfo = await getEntityInfoAtPosition(foundNode, mrScope, context, isTest);
            if (!hoverInfo) {
                return;
            }

            return formatDefinitionRes(model.uri as any, hoverInfo);
        },

        doReferences(
            position: Pos,
        ): languages.Location[] | undefined {
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

        doProvideCodeActions(range: IRange): languages.CodeActionList {
            const actions: languages.CodeAction[] = [];
            const position = posFromRange(range);
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context) {
                return { actions, dispose: () => { } }
            }
            if (matchSubPath(foundNode, ['id_', 'cteStatement'])) {
                actions.push({
                    title: CommandLabel[CommandId.CopyTestSql],
                    command: {
                        id: CommandId.CopyTestSql,
                        title: CommandLabel[CommandId.CopyTestSql],
                        arguments: [position],
                    }
                }, ...customActions.map(action => ({
                    title: action.title,
                    command: {
                        id: action.id,
                        title: action.title,
                        arguments: [position],
                    }
                })));
            }

            return { actions, dispose: () => {} }
        },
    };
}


export const createHiveSqlActions = ({
    tableSourceManager,
    onCopyToClipboard,
    isTest = false,
    noCache = false,
    customActions,
}: {
    tableSourceManager?: ITableSourceManager
    onCopyToClipboard?: (text: string) => void | Promise<void>;
    isTest?: boolean,
    noCache?: boolean,
    customActions?: {
        id: string;
        run: customActionRunHandler
    }[]
}) => {

    return [
        {
            id: CommandId.CopyTestSql,
            run: async (ed: {
                getValue: () => string;
                getPosition: () => Pos | null;
            }, position?: Pos) => {
                const { foundNode, context, mrScope } = getContextFromEditor(ed, position, tableSourceManager, noCache, isTest);
                if (!foundNode || !context || !mrScope) {
                    return;
                }

                const node = mrScope.getDebugNode();
                const sql = node ? getFormattedSqlFromNode(node) : '';
                if (onCopyToClipboard) {
                    await onCopyToClipboard(sql);
                } else {
                    console.warn('copyToClipboard', sql);
                }
            }
        },
        ...(customActions || [])
            .filter(action => action && action.id && action.run)
            .map(action => ({
                ...action,
                run: async (ed: {
                    getValue: () => string;
                    getPosition: () => Pos | null;
                }, position: Pos) => {
                    const { foundNode, contextManager, context, mrScope } = getContextFromEditor(ed, position, tableSourceManager, noCache, isTest);
                    if (!foundNode || !context || !mrScope) {
                        return;
                    }

                    return action?.run?.({
                        position,
                        foundNode,
                        contextManager,
                        context,
                        mrScope,
                    });
                }
            })),
    ] as {
        id: string;
        run: (ed: {
            getValue: () => string;
            getPosition: () => Pos | null;
        }, position: Pos) => Promise<void>;
    }[];


    function getContextFromEditor(
        ed: {
            getValue: () => string;
            getPosition: () => Pos | null;
        },
        position?: Pos,
        tableSourceManager?: ITableSourceManager,
        noCache: boolean = false,
        isTest: boolean = false,
    ) {
        if (!position) {
            position = ed.getPosition()!;
        }
        const text = ed.getValue();
        const {
            sqlSlices,
            tree,
            contextManager
        } = getContextWithCache(text, noCache, tableSourceManager);

        const getCtxFromPos = createGetCtxFromPos(sqlSlices, contextManager, tree, isTest ? console.log : () => { });

        const { foundNode, context, mrScope } = getCtxFromPos(position) || {};
        
        return {
            foundNode,
            contextManager,
            context: context || undefined,
            mrScope: mrScope || undefined
        };
    }
}

function createGetCtxFromPos(sqlSlices: TextSlice[] | null, contextManager: ContextManager, tree: ProgramContext, logger: (...args: any[]) => void) {
    return (position: Pos) => {
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
}
