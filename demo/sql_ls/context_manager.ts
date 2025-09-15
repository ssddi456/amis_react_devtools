
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
    tableInfoFromCteStatement,
    tableInfoFromSubQuerySource,
    tableInfoFromTableSource,
    tableInfoFromVirtualTableSource
} from "./helpers/table_and_column";
import { ITableSourceManager } from "./types";
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

    mrScopeGraph: Map<string, string[]> = new Map();

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

    createMrScopeGraph() {
        this.mrScopes.forEach((mrScope) => {
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
                        posRef = context.id_();
                    }

                    if (!posRef) {
                        console.log('createMrScopeGraph: cannot find position reference for input table', input);
                        return;
                    }
                    const pos = positionFromNode(posRef);
                    const { mrScope: refMrScope } = this.getSymbolByPosition(pos) || {};
                    if (refMrScope && !deps.includes(refMrScope.id)) {
                        if (refMrScope.id === mrScope.id) {
                            console.log('createMrScopeGraph: skip self reference', input, posRef, pos);
                            return;
                        }
                        deps.push(refMrScope.id);
                    }
                });
            }
            this.mrScopeGraph.set(id, deps);
        });
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

