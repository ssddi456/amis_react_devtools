
import { ParserRuleContext, ParseTree, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import { AtomSelectStatementContext, ColumnNameContext, ColumnNameCreateContext, ConstantContext, CteStatementContext, ExpressionContext, FromClauseContext, FromSourceContext, GroupByClauseContext, HavingClauseContext, JoinSourceContext, JoinSourcePartContext, ProgramContext, QualifyClauseContext, QueryStatementExpressionContext, SelectClauseContext, SelectItemContext, SelectStatementContext, SelectStatementWithCTEContext, SelectStmtContext, SubQueryExpressionContext, SubQuerySourceContext, TableAllColumnsContext, TableNameContext, TableSourceContext, VirtualTableSourceContext, WhereClauseContext, Window_clauseContext, WithClauseContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-editor";
import { isKeyWord } from "./sql_ls_helper";
import { IdentifierScope } from "./Identifier_scope";
import { MapReduceScope } from "./mr_scope";

export class ContextManager {
    identifierMap: Map<string, IdentifierScope> = new Map();
    rootContext: IdentifierScope | null = null;
    currentContext: IdentifierScope | null = null;

    mrScopes: MapReduceScope[] = [];

    constructor(public tree: ProgramContext) {
        const manager = this;
        this.rootContext = new IdentifierScope(tree);
        this.currentContext = this.rootContext;

        function enterRule(ctx: ParserRuleContext) {
            const newContext = manager.currentContext!.enterScope(ctx);
            manager.identifierMap.set(newContext.uuid, newContext);
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
                        const nextOnExpression = getNextOnExpression(children, part);
                        const nextUsingExpression = getNextUsingExpression(children, part);
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
                const tableName = ctx.tableOrView().tableName()?.getText();
                if (tableName) {
                    manager.currentContext?.addReference(tableName, ctx);
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
                    if (id) {
                        context?.addHighlightNode(id);
                        mrScope?.addExportColumn({
                            exportColumnName: id.getText(),
                            referanceColumnName: columnNameFromColumnPath(sourceColumn),
                            referanceTableName: tableNameFromColumnPath(sourceColumn),
                            reference: sourceColumn,
                            defineReference: id,
                        });
                    } else {
                        mrScope?.addExportColumn({
                            exportColumnName: sourceColumn.getText(),
                            referanceColumnName: columnNameFromColumnPath(sourceColumn),
                            referanceTableName: tableNameFromColumnPath(sourceColumn),
                            reference: sourceColumn,
                            defineReference: sourceColumn
                        });
                    }
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

        };

        ParseTreeWalker.DEFAULT.walk(listener, tree);
        console.assert(this.currentContext === this.rootContext, 'Context manager did not exit all scopes correctly');
        this.rootContext.collectScope();
    }

    getContextByPosition(position: Position): IdentifierScope | null {
        if (!this.rootContext) {
            return null;
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
                } else {
                    console.log('Not in range', position, child.range);
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
        console.log('Getting highlights', this.rootContext);
        return this.rootContext?.getHighlights() || [];
    }

    validate() {
        return this.rootContext?.validate() || [];
    }
}


export const createContextManager = (tree: ProgramContext) => {
    return new ContextManager(tree);
};


function tableInfoFromTableSource(
    currentContext: IdentifierScope | null,
    context: TableSourceContext | null,
): TableSourceContext | null {
    if (!currentContext || !context) {
        return null;
    }

    const alias = context.id_()?.getText();
    if (alias) {
        currentContext.addIdentifier(
            context.id_()?.getText() || '',
            context
        );
        currentContext.getMrScope()?.addInputTable(alias, context, context.id_()!);
    } else {
        const tableName = context.tableOrView()?.getText();
        currentContext.addReference(tableName, context);
        currentContext.getMrScope()?.addInputTable(tableName, context, context.tableOrView()!);
    }

    return context;
}

function tableInfoFromSubQuerySource(
    currentContext: IdentifierScope | null,
    subQuerySource: SubQuerySourceContext | null,
): SubQuerySourceContext | null {
    if (!currentContext || !subQuerySource) {
        return null;
    }
    const name = subQuerySource.id_()?.getText();
    currentContext.addIdentifier(name || '', subQuerySource, true);
    currentContext.getMrScope()?.addInputTable(name || '', subQuerySource, subQuerySource.id_()!);

    return subQuerySource;
}

function tableInfoFromVirtualTableSource(
    currentContext: IdentifierScope | null,
    virtualTableSource: VirtualTableSourceContext | null,
): VirtualTableSourceContext | null {
    if (!currentContext || !virtualTableSource) {
        return null;
    }
    const name = virtualTableSource.tableAlias()?.getText();
    currentContext.addIdentifier(name || '', virtualTableSource, true);
    currentContext.getMrScope()?.addInputTable(name || '', virtualTableSource, virtualTableSource.tableAlias()!);
    return virtualTableSource;
}

function tableInfoFromCteStatement(
    currentContext: IdentifierScope | null,
    cteStatement: CteStatementContext | null,
): CteStatementContext | null {
    if (!currentContext || !cteStatement) {
        return null;
    }
    const name = cteStatement.id_()?.getText();
    currentContext.addIdentifier(name || '', cteStatement, true);
    currentContext.getMrScope()?.addInputTable(name || '', cteStatement, cteStatement.id_()!);
    return cteStatement;
}

function getNextOnExpression(children: ParseTree[], current: JoinSourcePartContext): ParserRuleContext | null {
    const index = children.indexOf(current);
    if (index === -1 || index === children.length - 1) {
        return null;
    }
    for (let i = index + 1; i < children.length; i++) {
        const child = children[i];
        if (child instanceof JoinSourcePartContext) {
            return null;
        }
        if (isKeyWord(child, 'ON')) {
            return children[i + 1] as ParserRuleContext;
        }
    }
    return null
}


function getNextUsingExpression(children: ParseTree[], current: JoinSourcePartContext): ParserRuleContext | null {
    const index = children.indexOf(current);
    if (index === -1 || index === children.length - 1) {
        return null;
    }
    for (let i = index + 1; i < children.length; i++) {
        const child = children[i];
        if (child instanceof JoinSourcePartContext) {
            return null;
        }
        if (isKeyWord(child, 'USING')) {
            return children[i + 1] as ParserRuleContext;
        }
    }
    return null
}

function tableNameFromColumnPath(ctx: ColumnNameContext): string {
    const ids = ctx.poolPath()?.id_();
    if (ids?.length == 1) {
        return '';
    }
    if ((ids?.length || 0) > 1) {
        return ids ? ids[ids.length - 2]?.getText() : '';
    }
    return '';
}

function columnNameFromColumnPath(ctx: ColumnNameContext): string {
    const ids = ctx.poolPath()?.id_();
    return ids ? ids[ids.length - 1]?.getText() : '';
}