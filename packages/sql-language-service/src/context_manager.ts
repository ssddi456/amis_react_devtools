
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import {
    AtomSelectStatementContext,
    ColumnNameContext,
    ColumnNameCreateContext,
    ColumnNamePathContext,
    ConstantContext,
    CteStatementContext,
    ExpressionContext,
    FromClauseContext,
    FromSourceContext,
    Function_Context,
    GroupByClauseContext,
    HavingClauseContext,
    JoinSourceContext,
    OrderByClauseContext,
    ProgramContext,
    QualifyClauseContext,
    QueryStatementExpressionContext,
    SelectClauseContext,
    SelectItemContext,
    SelectStatementContext,
    SelectStatementWithCTEContext,
    SortByClauseContext,
    SubQuerySourceContext,
    TableNameContext,
    TableNameCreateContext,
    TableSourceContext,
    VirtualTableSourceContext,
    WhereClauseContext,
    Window_clauseContext,
    WithClauseContext
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import {
    findTokenAtPosition,
    getColumnInfoFromNode,
    getNextUsingKeyword,
    getTableNameFromContext,
    tableInfoFromCteStatement,
    tableInfoFromSubQuerySource,
    tableInfoFromTableSource,
    tableInfoFromVirtualTableSource
} from "./helpers/table_and_column";
import { ITableSourceManager, MrScopeContext, MrScopeNodeData } from "./types";
import { IdentifierScope, SymbolAndContext } from "./identifier_scope";
import { MapReduceScope } from "./mr_scope";
import { createLogger, printNode } from "./helpers/log";
import { getAllEntityInfoFromNode } from "./helpers/getTableAndColumnInfoAtPosition";
import { formatHoverRes } from "./formatHoverRes";
import { Pos, positionFromNode } from "./helpers/pos";
import { WithSource } from "./helpers/util";
import { ErrorType } from "./consts";
import { mrScopeGraphOptimize } from "./helpers/graph";

const logger = createLogger('ContextManager', process.env.NODE_ENV !== 'prod');

export class ContextManager {
    rootContext: IdentifierScope | null = null;
    currentContext: IdentifierScope | null = null;

    mrScopes: MapReduceScope[] = [];

    mrScopeGraph: Map<string, WithSource<Omit<MrScopeNodeData, 'id' | 'description' | 'label' | 'onNodeSizeChange'>>> = new Map();

    constructor(public tree: ProgramContext, public tableSourceManager?: ITableSourceManager) {
        const manager = this;
        this.rootContext = new IdentifierScope(tree, null, null);
        this.rootContext.tableSourceManager = tableSourceManager;
        this.currentContext = this.rootContext;
        const contextStack: IdentifierScope[] = [];

        function enterRule(ctx: ParserRuleContext, parentContext: IdentifierScope | null = manager.currentContext) {
            contextStack.push(manager.currentContext!);
            // console.log('enterRule', printNode(ctx));
            const newContext = parentContext!.enterScope(ctx);
            manager.currentContext = newContext;
            return newContext;
        }

        function exitRule() {
            manager.currentContext = contextStack.pop()!;
        }

        function enterTable(ctx: MrScopeContext, identifierScope: IdentifierScope) {
            const mrScope = new MapReduceScope(ctx, identifierScope, manager.mrScopes.length);
            manager.mrScopes.push(mrScope);
            identifierScope.mrScope = mrScope;
        }

        const listener = new class extends HiveSqlParserListener {
            enterQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
                const identifierScope = enterRule(ctx);
                enterTable(ctx, identifierScope);
            };
            exitQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
                exitRule();
            };
            enterAtomSelectStatement = (ctx: AtomSelectStatementContext) => {
                const identifierScope = enterRule(ctx);
                enterTable(ctx, identifierScope);
            };
            exitAtomSelectStatement = (ctx: AtomSelectStatementContext) => {
                exitRule();
            };
            enterSelectStatementWithCTE = (ctx: SelectStatementWithCTEContext) => {
                enterRule(ctx);
            };
            exitSelectStatementWithCTE = (ctx: SelectStatementWithCTEContext) => {
                exitRule();
            };
            enterSelectStatement = (ctx: SelectStatementContext) => {
                const identifierScope = enterRule(ctx);
                enterTable(ctx, identifierScope);
            };
            exitSelectStatement = (ctx: SelectStatementContext) => {
                exitRule();
            };
            enterFromClause = (ctx: FromClauseContext) => {
                enterRule(ctx);
            };
            exitFromClause = (ctx: FromClauseContext) => {
                exitRule();
            };
            enterWithClause = (ctx: WithClauseContext) => {
                const ctes = ctx.cteStatement();
                ctes.forEach((cte) => {
                    tableInfoFromCteStatement(manager.currentContext, cte);
                });
            };

            enterJoinSource = (ctx: JoinSourceContext) => {
                if (ctx.parent instanceof FromSourceContext) {
                    const atomjoinSource = ctx.atomjoinSource();
                    const defaultTableInfo = [
                        tableInfoFromTableSource(
                            manager.currentContext,
                            atomjoinSource.tableSource()
                        ),
                        tableInfoFromSubQuerySource(
                            manager.currentContext,
                            atomjoinSource.subQuerySource()
                        ),
                        tableInfoFromVirtualTableSource(
                            manager.currentContext,
                            atomjoinSource.virtualTableSource()
                        ),
                    ].find((x) => x !== null);

                    if (defaultTableInfo) {
                        manager.currentContext?.getMrScope()?.setDefaultInputTable('', defaultTableInfo);
                    }

                    const children = ctx.children!;
                    const joinSourceParts = ctx.joinSourcePart();
                    for (let i = 0; i < joinSourceParts.length; i++) {
                        const part = joinSourceParts[i];
                        tableInfoFromTableSource(
                            manager.currentContext,
                            part.tableSource()
                        );
                        tableInfoFromSubQuerySource(
                            manager.currentContext,
                            part.subQuerySource()
                        );
                        tableInfoFromVirtualTableSource(
                            manager.currentContext,
                            part.virtualTableSource()
                        );

                        const nextUsing = getNextUsingKeyword(children, part);

                        if (nextUsing) {
                            manager.rootContext?.addUnsupportedFeature(`Using 'USING' clause is not supported`, nextUsing);
                        }
                    }
                }
            }

            enterExpression = (ctx: ExpressionContext) => {
                if (ctx.parent instanceof JoinSourceContext) {
                    enterRule(ctx);
                }
            };

            exitExpression = (ctx: ExpressionContext) => {
                if (ctx.parent instanceof JoinSourceContext) {
                    exitRule();
                }
            };


            enterSelectClause = (ctx: SelectClauseContext) => {
                enterRule(ctx);
            };
            exitSelectClause = (ctx: SelectClauseContext) => {
                exitRule();
            };
            enterWhereClause = (ctx: WhereClauseContext) => {
                enterRule(ctx);
            };
            exitWhereClause = (ctx: WhereClauseContext) => {
                exitRule();
            };
            enterGroupByClause = (ctx: GroupByClauseContext) => {
                enterRule(ctx);
            };
            exitGroupByClause = (ctx: GroupByClauseContext) => {
                exitRule();
            };
            enterHavingClause = (ctx: HavingClauseContext) => {
                enterRule(ctx);
            };
            exitHavingClause = (ctx: HavingClauseContext) => {
                exitRule();
            };
            enterWindow_clause = (ctx: Window_clauseContext) => {
                enterRule(ctx);
            };
            exitWindow_clause = (ctx: Window_clauseContext) => {
                exitRule();
            };
            enterQualifyClause = (ctx: QualifyClauseContext) => {
                enterRule(ctx);
            };
            exitQualifyClause = (ctx: QualifyClauseContext) => {
                exitRule();
            };
            enterOrderByClause = (ctx: OrderByClauseContext) => {
                // if (ctx.parent instanceof SelectStatementContext) {
                //     const parent = manager.currentContext?.children.find(c => c.context instanceof AtomSelectStatementContext);
                //     enterRule(ctx, parent || manager.currentContext);
                // } else {
                //     enterRule(ctx);
                // }
                enterRule(ctx);
            };
            exitOrderByClause = (ctx: OrderByClauseContext) => {
                exitRule();
            };
            enterSortByClause = (ctx: SortByClauseContext) => {
                // if (ctx.parent instanceof SelectStatementContext) {
                //     const parent = manager.currentContext?.children.find(c => c.context instanceof AtomSelectStatementContext);
                //     enterRule(ctx, parent || manager.currentContext);
                // } else {
                //     enterRule(ctx);
                // }
                enterRule(ctx);
            };
            exitSortByClause = (ctx: SortByClauseContext) => {
                exitRule();
            };

            enterTableSource = (ctx: TableSourceContext) => {
                const alias = ctx.id_()?.getText();
                if (alias) {
                    manager.currentContext?.addHighlightNode(ctx.id_()!);
                }
            };

            enterColumnName = (ctx: ColumnNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterColumnNamePath = (ctx: ColumnNamePathContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterColumnNameCreate = (ctx: ColumnNameCreateContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterTableName = (ctx: TableNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterTableNameCreate = (ctx: TableNameCreateContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterSelectItem = (ctx: SelectItemContext) => {
                const context = manager.currentContext;
                const mrScope = context?.getMrScope();
                const allColumns = ctx.tableAllColumns();
                if (allColumns) {
                    mrScope?.addExportColumn({
                        exportColumnName: '*', // will be all_columns from the refed table;
                        referenceTableName: allColumns.id_(0)?.getText?.() || '',
                        referenceColumnName: '*',
                        reference: allColumns,
                        defineReference: allColumns
                    });
                    context?.addHighlightNode(allColumns);
                    return;
                }

                const sourceColumn = ctx.columnName();
                if (sourceColumn) {
                    const id = ctx.id_()[0];
                    const columnInfo = getColumnInfoFromNode(sourceColumn, id);
                    if (id) {
                        context?.addHighlightNode(id);
                    }
                    mrScope?.addExportColumn(columnInfo);
                }
                const expression = ctx.expression();
                if (expression) {
                    context?.addHighlightNode(expression);
                    const id = ctx.id_();
                    for (const i of id) {
                        context?.addHighlightNode(i);
                        mrScope?.addExportColumn({
                            exportColumnName: i.getText(),
                            referenceColumnName: '',
                            referenceTableName: '',
                            reference: expression,
                            defineReference: i,
                        });
                    }
                }
            };

            enterConstant = (ctx: ConstantContext) => {
                // manager.currentContext?.addHighlight({
                //     start: ctx.start?.start || 0,
                //     end: (ctx.stop?.stop || 0) + 1,
                // });
            };

            enterFunction_? = (ctx: Function_Context) => {
                // get function name
                const name = ctx.functionNameForInvoke()?.getText();
                // collection function names

            }

        };

        ParseTreeWalker.DEFAULT.walk(listener, tree);
        console.assert(this.currentContext === this.rootContext, 'Context manager did not exit all scopes correctly');
        this.rootContext.collectScope();

        this.createMrScopeGraph();
    }

    getContextByPosition(position: Pos): IdentifierScope | null {
        if (!this.rootContext) {
            return null;
        }
        const symbols = this.getSymbolsAndContext();
        if (symbols) {
            for (let i = 0; i < symbols.length; i++) {
                const element = symbols[i];
                if (element.context.containsPosition(position)) {
                    return element.context;
                }
            }
        }
        let checkNodes: IdentifierScope[] = [this.rootContext];
        let lastContext: IdentifierScope | null = null;
        while (true) {
            let foundNode = false;
            for (const child of checkNodes) {
                if (child.containsPosition(position)) {
                    foundNode = true;
                    lastContext = child;
                    if (!child.children.length) {
                        return child;
                    }
                    checkNodes = child.children;
                    break;
                }
            }
            if (!foundNode) {
                break;
            }
        }

        return lastContext;
    }

    getHighlights() {
        return this.rootContext?.getHighlights() || [];
    }

    _symbolsCache: SymbolAndContext[] | null = null;
    getSymbolsAndContext() {
        if (!this._symbolsCache) {
            this._symbolsCache = this.rootContext?.getSymbolsAndContext() || [];
        }
        return this._symbolsCache;
    }

    getSymbolByPosition(position: Pos): SymbolAndContext & { foundNode: ParserRuleContext | null } | null {
        const symbols = this.getSymbolsAndContext();
        if (symbols) {
            for (let i = 0; i < symbols.length; i++) {
                const element = symbols[i];
                const foundNode = findTokenAtPosition(position, element.range.context);
                if (foundNode) {
                    console.log('getSymbolByPosition', foundNode.getText(), element);
                    return {
                        foundNode,
                        ...element,
                    };
                }
            }
        }
        console.log('getSymbolByPosition not found', position);
        return null;
    }

    getMrScopeByQueryStatement(ctx: QueryStatementExpressionContext | AtomSelectStatementContext): MapReduceScope | null {
        const mrScope = this.mrScopes.find(mr => mr.context === ctx);
        return mrScope || null;
    }

    createMrScopeGraph() {
        this.mrScopes.forEach((mrScope) => {
            console.group(`createMrScopeGraph: mrScope [${mrScope.mrOrder}] ${mrScope.id} ` );
            const id = mrScope.id;
            const children = mrScope.getChildScopes();
            const deps = children.map(x => x.id);
            if (mrScope.inputTables.length > 0) {
                // try to find input from other mrScopes
                mrScope.inputTables.forEach(input => {
                    const context = input.reference;

                    let posRef: ParserRuleContext | null = null;
                    if (context instanceof TableSourceContext) {
                        posRef = context;
                    } else if (context instanceof VirtualTableSourceContext) {
                        posRef = context.tableAlias();
                    } else if (context instanceof SubQuerySourceContext) {
                        posRef = context.id_();
                    } else if (context instanceof CteStatementContext) {
                        console.assert(false, 'CteStatementContext should not be here');
                    }

                    if (!posRef) {
                        return;
                    }

                    const pos = positionFromNode(posRef);
                    const { context: refContext, } = this.getSymbolByPosition(pos) || {};
                    const tableDef = refContext?.lookupDefinition(input.tableName);
                    const defineScope = refContext?.getDefinitionScope(input.tableName) || mrScope;
                    if (tableDef) {
                        if (tableDef instanceof CteStatementContext) {
                            const mrOfDef = this.getMrScopeByQueryStatement(tableDef.queryStatementExpression());
                            if (mrOfDef && mrOfDef.id !== id && !deps.includes(mrOfDef.id)) {
                                deps.push(mrOfDef.id);
                            }
                            return;
                        }

                        if (tableDef instanceof TableSourceContext) {
                            console.log(`createMrScopeGraph: found external table ${input.tableName} | mrScope ${mrScope.mrOrder}`);
                            const tableInfo = getTableNameFromContext(tableDef);
                            this.mrScopeGraph.set(tableInfo.tableId, {
                                deps: [],
                                pos: positionFromNode(tableDef),
                                type: 'external',
                                isOrphan: false,
                            });
                            deps.push(tableInfo.tableId);
                            return;
                        }

                        if (deps.includes(defineScope.id) || defineScope.id === id) {
                            console.log(`createMrScopeGraph: found input table ${input.tableName} from mrScope ${defineScope.mrOrder} (already in deps)`);
                        } else {
                            deps.push(defineScope.id);
                        }
                    } else {
                        this.mrScopeGraph.set(input.tableName, {
                            deps: [],
                            pos: positionFromNode(posRef),
                            type: 'external',
                            isOrphan: false,
                        });
                        deps.push(input.tableName);
                    }
                });
            }
            console.log('deps', deps);
            console.assert(!deps.includes(id), 'mrScope cannot depend on itself');
            console.groupEnd();
            this.mrScopeGraph.set(id, {
                deps,
                pos: positionFromNode(mrScope.context),
                type: 'local',
                isOrphan: false,
            });
        });

        // check orphan ctes
        this.mrScopeGraph.forEach((node, id) => {
            const mrScope = this.getMrScopeById(id);
            if (!mrScope) {
                return;
            }
            const orphanTables = mrScope.getOrphanTableDefinitions();
            orphanTables.forEach((tableDef) => {
                const orphanScope = this.getMrScopeByQueryStatement((tableDef.reference as CteStatementContext).queryStatementExpression?.());
                if (orphanScope) {
                    console.log('mark orphan mrScope', orphanScope.id, 'from tableDef', tableDef.tableName);

                    const originNode = this.mrScopeGraph.get(orphanScope.id);
                    if (originNode) {
                        console.log('mark orphan mrScope', orphanScope.id, 'from tableDef', tableDef.tableName);
                        originNode.isOrphan = true;
                        this.mrScopeGraph.set(orphanScope.id, originNode);
                    }
                }
            });
        });
        const rootId = this.mrScopes.find(mr => mr.mrOrder === 0)?.id!;
        mrScopeGraphOptimize(this, rootId);
    }

    getMrScopeGraphNodeAndEdges(): {
        nodes: { id: string; data: MrScopeNodeData; position: { x: number; y: number } }[];
        edges: { id: string; from: string; to: string, sourceHandle: string, targetHandle: string }[];
    } {
        const nodes: { id: string; data: MrScopeNodeData; position: { x: number; y: number } }[] = [];

        const edges: { id: string; from: string; to: string, sourceHandle: string, targetHandle: string }[] = [];
        this.mrScopeGraph.forEach((node, id) => {
            const mrScope = this.getMrScopeById(id);
            if (!mrScope) {
                if (node.type === 'external') {
                    nodes.push({ id, data: {
                        ...node,
                        id,
                        label: id,
                        description: '',
                    }, position: { x: 0, y: 0 } });
                } else {
                    console.warn('Cannot find mrScope for id', id, node);
                }
                return;
            }

            if (mrScope.mrOrder === 0) {
                const deps = node.deps;
                const depDatas = deps.map(depId => this.mrScopeGraph.get(depId)).filter(x => x);
                if (depDatas.some(x => x!.type !== 'local')) {
                    nodes.push({ id, data: {
                        ...node,
                        id,
                        label: 'root',
                        description: '',
                    }, position: { x: 0, y: 0 } });
                    deps.forEach(dep => {
                        edges.push({
                            id: `${dep}->${id}`,
                            to: dep,
                            from: id,
                            targetHandle: 'input',
                            sourceHandle: dep,
                        });
                    });
                }
                return;
            }
            
            const { deps, type } = node;
            nodes.push({ id, data: {
                ...node,
                id,
                label: 'order ' + this.getMrScopeById(id)?.mrOrder,
                description: '',
            }, position: { x: 0, y: 0 } });

            deps.forEach(dep => {
                edges.push({
                    id: `${dep}->${id}`,
                    to: dep,
                    from: id,
                    targetHandle: 'input',
                    sourceHandle: dep,
                });
            });
        });

        return { nodes, edges };
    }

    getMrScopeById(id: string): MapReduceScope | null {
        const mrScope = this.mrScopes.find(mr => mr.id === id);
        return mrScope || null;
    }

    async validate(isTest: boolean = false) {
        const errors = this.rootContext?.validate() || [];


        const symbols = this.getSymbolsAndContext() || [];
        await Promise.all(symbols.map(async ({ range, mrScope, context }, i) => {
            const hoverInfo = await getAllEntityInfoFromNode(range.context, context, mrScope, isTest);
            if (!hoverInfo) {
                errors.push({
                    type: ErrorType.RefNotFound,
                    level: 'error',
                    message: `Reference not found: ${printNode(range.context)}`,
                    context: range.context,
                });
                return;
            }

            if (
                hoverInfo.type == 'unknown'
                || hoverInfo.type == 'noTable'
                || hoverInfo.type == 'noColumn'
            ) {
                logger.logSource(hoverInfo);
                const res = formatHoverRes(hoverInfo)!;
                errors.push({
                    type: ErrorType.RefNotFound,
                    level: 'error',
                    context: range.context,
                    message: res.contents[0].value,
                });
            }
        }));
        return errors;
    }
}

export const createContextManager = (tree: ProgramContext, tableSourceManager?: ITableSourceManager) => {
    return new ContextManager(tree, tableSourceManager);
};

