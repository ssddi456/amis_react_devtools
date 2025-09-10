
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import {
    AtomSelectStatementContext,
    ColumnNameContext,
    ColumnNameCreateContext,
    ConstantContext,
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
    TableNameContext,
    TableSourceContext,
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

export class ContextManager {
    rootContext: IdentifierScope | null = null;
    currentContext: IdentifierScope | null = null;

    mrScopes: MapReduceScope[] = [];

    constructor(public tree: ProgramContext, public tableSourceManager?: ITableSourceManager) {
        const manager = this;
        this.rootContext = new IdentifierScope(tree, null, null);
        this.rootContext.tableSourceManager = tableSourceManager;
        this.currentContext = this.rootContext;

        function enterRule(ctx: ParserRuleContext) {
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
            const mrScope = new MapReduceScope(ctx, identifierScope);
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

                    manager.currentContext?.addHighlightNode(cte.id_());
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
                    manager.currentContext?.addReference(alias, ctx);
                    manager.currentContext?.addHighlightNode(ctx.id_()!);
                } else {
                    const tableName = ctx.tableOrView().tableName()?.getText();
                    if (tableName) {
                        manager.currentContext?.addReference(tableName, ctx);
                    }
                }
            };

            enterColumnName = (ctx: ColumnNameContext) => {
                const context = manager.currentContext;
                const mrScope = context?.getMrScope();

                const ids = ctx.poolPath()?.id_();
                if (ids?.length == 1) {
                    // Single identifier, likely a column name
                    // do nothing
                } else if (ids?.length == 2) {
                    // Two identifiers, likely a table.column name
                    const tableName = ids[0].getText();
                    // TODO: 需要先记下来，在exit scope时清理引用
                    manager.currentContext?.addReference(tableName, ctx);
                }
                manager.currentContext?.addHighlightNode(ctx);
            };

            enterColumnNamePath = (ctx: ColumnNameContext) => {
                const ids = ctx.poolPath()?.id_();
                if (ids?.length == 1) {
                    // Single identifier, likely a column name
                    // do nothing
                } else if (ids?.length == 2) {
                    // Two identifiers, likely a table.column name
                    const tableName = ids[0].getText();
                    manager.currentContext?.addReference(tableName, ctx);
                }
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

    getSymbolByPosition(position: Position): SymbolAndContext & { foundNode: ParserRuleContext | null } | null {
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

    validate() {
        return this.rootContext?.validate() || [];
    }
}

export const createContextManager = (tree: ProgramContext, tableSourceManager?: ITableSourceManager) => {
    return new ContextManager(tree, tableSourceManager);
};

