
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import { ExpressionContext, FromSourceContext, GroupByClauseContext, HavingClauseContext, JoinSourceContext, ProgramContext, QualifyClauseContext, QueryStatementExpressionContext, SelectClauseContext, SelectStatementContext, SelectStatementWithCTEContext, SubQueryExpressionContext, SubQuerySourceContext, TableSourceContext, VirtualTableSourceContext, WhereClauseContext, Window_clauseContext, WithClauseContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-editor";
import { posInRange } from "./ls_helper";
import { printNode } from "./sql_ls_helper";

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export class IdentifierScope {
    uuid = uuidv4();
    indentifierMap: Map<string, ParserRuleContext> = new Map();
    defaultIdentifier: ParserRuleContext | null = null;
    children: IdentifierScope[] = [];

    constructor(
        public context: ParserRuleContext,
        public parent: IdentifierScope | null = null
    ) {
    }

    get range() {
        if (!this.context) {
            return null;
        }

        return {
            startLineNumber: this.context.start!.line,
            startColumn: this.context.start!.column,
            endLineNumber: this.context.stop!.line,
            endColumn: this.context.stop!.column + (this.context.stop!.text || '').length
        };
    }

    setDefaultIdentifier(identifier: ParserRuleContext) {
        this.defaultIdentifier = identifier;
    }

    addIdentifier(name: string, alias: string | undefined, identifier: ParserRuleContext) {
        if (identifier) {
            this.indentifierMap.set(name, identifier);
            if (alias) {
                this.indentifierMap.set(alias, identifier);
            }
        }
    }

    getAllIdentifiers() {
        const identifiers = new Map<string, ParserRuleContext>(this.indentifierMap);
        if (this.parent) {
            const parentIdentifiers = this.parent.getAllIdentifiers();
            parentIdentifiers.forEach((value, key) => {
                if (!identifiers.has(key)) {
                    identifiers.set(key, value);
                }
            });
        }
        return identifiers;
    }
    
    getDefaultIdentifier(): ParserRuleContext | null {
        if (this.defaultIdentifier) {
            return this.defaultIdentifier;
        }
        if (this.parent) {
            return this.parent.getDefaultIdentifier();
        }
        return null;
    }

    enterScope(context: ParserRuleContext) {
        const newScope = new IdentifierScope(context, this);
        this.children.push(newScope);
        return newScope;
    }

    exitScope() {
        if (this.parent) {
            return this.parent;
        }
    }

    lookupDefinition(item: ParserRuleContext, fn: (item: ParserRuleContext) => any): any {
        if (!item) {
            return null;
        }
        const definition = fn(item);
        if (definition) {
            return definition;
        }
        return this.parent ? this.parent.lookupDefinition(item, fn) : null;
    }

    containsPosition(position: Position): boolean {
        if (!this.range) {
            return false;
        }
        return posInRange(position, this.range);
    }

    toString(depth: number = 0, result: string[] = []) {
        const indent = ' '.repeat(depth * 2);
        result.push(`${indent}(${printNode(this.context)})`);
        const identifiers = this.indentifierMap.entries();
        Array.from(identifiers).forEach(([name, identifier]) => {
            result.push(`${indent}  ${name} -> ${printNode(identifier)}`);
        });
        this.children.forEach(child => {
            child.toString(depth + 1, result);
        });
        return result.join('\n');
    } 
}

class ContextManager {
    identifierMap: Map<string, IdentifierScope> = new Map();
    rootContext: IdentifierScope | null = null;
    currentContext: IdentifierScope | null = null;

    constructor(public tree: ProgramContext) {
        const manager = this;
        this.rootContext = new IdentifierScope(tree);
        this.currentContext = this.rootContext;

        function enterRule(ctx: ParserRuleContext) {
            const newContext = manager.currentContext!.enterScope(ctx);
            manager.identifierMap.set(newContext.uuid, newContext);
            manager.currentContext = newContext;
        }

        function exitRule() {
            if (manager.currentContext) {
                manager.currentContext = manager.currentContext.exitScope()!;
            }
        }
        const listener = new class extends HiveSqlParserListener {
            enterQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
                enterRule(ctx);
            };
            exitQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
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
            enterWithClause = (ctx: WithClauseContext) => {
                const ctes = ctx.cteStatement();
                ctes.forEach((cte) => {
                    const cteName = cte.id_().getText();
                    manager.currentContext?.addIdentifier(cteName, undefined, cte);
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
                    }

                    const joinSourceParts = ctx.joinSourcePart();
                    for (const part of joinSourceParts) {
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
        };

        ParseTreeWalker.DEFAULT.walk(listener, tree);
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
    currentContext.addIdentifier(
        context.tableOrView().tableName()?.getText() || '',
        context.id_()?.getText() || '',
        context
    );
    return context;
}

const localDbId = 'local db';

function tableInfoFromSubQuerySource(
    currentContext: IdentifierScope | null,
    subQuerySource: SubQuerySourceContext | null,
): SubQuerySourceContext | null {
    if (!currentContext || !subQuerySource) {
        return null;
    }
    const name = subQuerySource.id_()?.getText();
    currentContext.addIdentifier(name || '', undefined, subQuerySource);
    return subQuerySource;
}

function tableInfoFromVirtualTableSource(
    currentContext: IdentifierScope | null,
    virtualTableSource: VirtualTableSourceContext | null,
): VirtualTableSourceContext | null {
    if (!currentContext || !virtualTableSource) {
        return null;
    }
    const alias = virtualTableSource.tableAlias()?.getText();
    currentContext.addIdentifier(alias || '', undefined, virtualTableSource);
    return virtualTableSource;
}
