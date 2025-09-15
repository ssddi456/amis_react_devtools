
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import {
    AtomSelectStatementContext,
    ColumnNameContext,
    ColumnNameCreateContext,
    ConstantContext,
    CteStatementContext,
    ExpressionContext,
    FromClauseContext,
    FromSourceContext,
    Function_Context,
    GroupByClauseContext,
    HavingClauseContext,
    JoinSourceContext,
    ProgramContext,
    QualifyClauseContext,
    QueryStatementExpressionContext,
    SelectClauseContext,
    SelectItemContext,
    SelectStatementContext,
    SelectStatementWithCTEContext,
    SubQuerySourceContext,
    TableNameContext,
    TableSourceContext,
    VirtualTableSourceContext,
    WhereClauseContext,
    Window_clauseContext,
    WithClauseContext
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-editor";
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
import { ITableSourceManager, MrScopeNodeData, tableDefType } from "./types";
import { IdentifierScope, SymbolAndContext } from "./identifier_scope";
import { MapReduceScope } from "./mr_scope";
import { printNode } from "./helpers/log";
import { getAllEntityInfoFromNode } from "./helpers/getTableAndColumnInfoAtPosition";
import { formatHoverRes } from "./formatHoverRes";
import { Pos, positionFromNode } from "./helpers/pos";

export class ContextManager {
    rootContext: IdentifierScope | null = null;
    currentContext: IdentifierScope | null = null;

    mrScopes: MapReduceScope[] = [];

    mrScopeGraph: Map<string, { deps: string[], type: tableDefType }> = new Map();

    constructor(public tree: ProgramContext, public tableSourceManager?: ITableSourceManager) {
        const manager = this;
        this.rootContext = new IdentifierScope(tree, null, null);
        this.rootContext.tableSourceManager = tableSourceManager;
        this.currentContext = this.rootContext;

        function enterRule(ctx: ParserRuleContext) {
            console.log('enterRule', printNode(ctx));
            const newContext = manager.currentContext!.enterScope(ctx);
            manager.currentContext = newContext;
            return newContext;
        }

        function exitRule() {
            if (manager.currentContext) {
                manager.currentContext = manager.currentContext.parent;
            }
        }

        function enterTable(ctx: QueryStatementExpressionContext | AtomSelectStatementContext, identifierScope: IdentifierScope) {
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
                enterRule(ctx);
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
                        manager.currentContext?.setDefaultIdentifier(defaultTableInfo);
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

            enterTableSource = (ctx: TableSourceContext) => {
                const alias = ctx.id_()?.getText();
                if (alias) {
                    manager.currentContext?.addHighlightNode(ctx.id_()!);
                }
            };

            enterColumnName = (ctx: ColumnNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterColumnNamePath = (ctx: ColumnNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterColumnNameCreate = (ctx: ColumnNameCreateContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterTableName = (ctx: TableNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterTableNamCreate = (ctx: TableNameContext) => {
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterSelectItem = (ctx: SelectItemContext) => {
                const context = manager.currentContext;
                const mrScope = context?.getMrScope();
                const allColumns = ctx.tableAllColumns();
                if (allColumns) {
                    mrScope?.addExportColumn({
                        exportColumnName: '*', // will be all_columns from the refed table;
                        referanceTableName: allColumns.id_(0)?.getText?.() || '',
                        referanceColumnName: '*',
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
                            referanceColumnName: '',
                            referanceTableName: '',
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

    getContextByPosition(position: Position): IdentifierScope | null {
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

    toString() {
        if (!this.rootContext) {
            return 'No context';
        }

        return this.rootContext.toString();
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
            if (mrScope.mrOrder === 0) {
                return;
            }
            console.group(`createMrScopeGraph: mrScope [${mrScope.mrOrder}] ${mrScope.id} ` );
            const id = mrScope.id;
            const children = mrScope.getChildScopes();
            console.log('children', children.map(x => x.id));
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
                        posRef = context.id_();
                    }

                    if (!posRef) {
                        return;
                    }

                    const pos = positionFromNode(posRef);
                    const { context: refContext } = this.getSymbolByPosition(pos) || {};
                    const defineScope = refContext?.getDefinitionScope(input.tableName);
                    if (defineScope) {
                        // get real define
                        const tableDef = defineScope.getTableByName(input.tableName);
                        if (tableDef instanceof CteStatementContext) {
                            const mrOfDef = this.getMrScopeByQueryStatement(tableDef.queryStatementExpression());
                            if (mrOfDef && mrOfDef.id !== id && !deps.includes(mrOfDef.id)) {
                                console.log(`createMrScopeGraph: found local table ${input.tableName} | mrScope ${mrOfDef.mrOrder}`);
                                deps.push(mrOfDef.id);
                            }
                            return;
                        }

                        if (tableDef instanceof TableSourceContext) {
                            console.log(`createMrScopeGraph: found external table ${input.tableName} | mrScope ${mrScope.mrOrder}`);
                            const tableInfo = getTableNameFromContext(tableDef);
                            this.mrScopeGraph.set(tableInfo.tableId, { deps: [], type: 'external' });
                            deps.push(tableInfo.tableId);
                            return;
                        }

                        if (deps.includes(defineScope.id)) {
                            console.log(`createMrScopeGraph: found input table ${input.tableName} from mrScope ${defineScope.mrOrder} (already in deps)`);
                        } else {
                            deps.push(defineScope.id);
                        }
                    } else {
                        this.mrScopeGraph.set(input.tableName, { deps: [], type: 'external' });
                        deps.push(input.tableName);
                    }
                });
            }
            console.log('deps', deps);
            console.groupEnd();
            this.mrScopeGraph.set(id, {deps, type: 'local'});
        });
    }

    getMrScopeGraphNodeAndEdges(): {
        nodes: { id: string; data: MrScopeNodeData; position: { x: number; y: number } }[];
        edges: { id: string; from: string; to: string }[];
    } {
        const nodes = this.mrScopes.filter(mr => mr.mrOrder > 0).map(mr => ({
            id: mr.id, data: {
                id: mr.id,
                type: 'local' as tableDefType,
                label: `order: ${mr.mrOrder}`,
                description: '',
            }, position: { x: 0, y: 0 } }));
        const edges: { id: string; from: string; to: string }[] = [];
        this.mrScopeGraph.forEach(({type, deps}, id) => {
            if (type === 'external') {
                nodes.push({ id, data: {
                    id,
                    type: 'external' as tableDefType,
                    label: id,
                    description: '',
                }, position: { x: 0, y: 0 } });
                return;
            }

            deps.forEach(dep => {
                edges.push({ id: `${dep}->${id}`, from: dep, to: id });
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
                    type: 'no_hover_info',
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
                const res = formatHoverRes(hoverInfo)!;
                errors.push({
                    type: 'no_hover_info',
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

