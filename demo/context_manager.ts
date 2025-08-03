
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import { ColumnNameContext, ExpressionContext, FromSourceContext, GroupByClauseContext, HavingClauseContext, JoinSourceContext, ProgramContext, QualifyClauseContext, QueryStatementExpressionContext, SelectClauseContext, SelectStatementContext, SelectStatementWithCTEContext, SubQueryExpressionContext, SubQuerySourceContext, TableSourceContext, VirtualTableSourceContext, WhereClauseContext, Window_clauseContext, WithClauseContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
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

    identifierMap: Map<string, ParserRuleContext> = new Map();

    referenceMap: Map<string, ParserRuleContext[]> = new Map();

    referenceNotFound: Map<string, ParserRuleContext[]> = new Map();

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

    addIdentifier(name: string, identifier: ParserRuleContext) {
        if (identifier) {
            this.identifierMap.set(name, identifier);
        }
    }

    getAllIdentifiers() {
        const identifiers = new Map<string, ParserRuleContext>(this.identifierMap);
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
        const defaultIdentifier = this.parent?.defaultIdentifier;
        if (defaultIdentifier) {
            if (defaultIdentifier instanceof TableSourceContext) {
                const tableName = defaultIdentifier.tableOrView().getText();
                const parentRes = this.parent?.lookupDefinition(tableName);
                if (parentRes) {
                    return parentRes;
                }
            }
            return defaultIdentifier;
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
            const parent = this.parent;
            // 清理references
            this.referenceMap.forEach((refs, name) => {
                if (!this.identifierMap.has(name)) {
                    console.log('reference shift', name);
                    this.referenceMap.delete(name);
                    refs.forEach(ref => {
                        parent.addReference(name, ref);
                    });
                } else {
                    const identifier = this.identifierMap.get(name);
                    this.referenceMap.set(name, refs.filter(ref => ref !== identifier));
                }
            });

            return this.parent;
        }

        this.referenceMap.forEach((refs, name) => {
            if (!this.identifierMap.has(name)) {
                this.referenceNotFound.set(name, refs);
                this.referenceMap.delete(name);
            } else {
                const identifier = this.identifierMap.get(name);
                this.referenceMap.set(name, refs.filter(ref => ref !== identifier));
            }
        });
    }

    lookupDefinition(name: string): ParserRuleContext | null {
        const identifier = this.identifierMap.get(name);
        if (!identifier) {
            return this.parent ? this.parent.lookupDefinition(name) : null;
        }
        if (identifier instanceof TableSourceContext) {
            const name = identifier.tableOrView().getText();
            const parentRes = this.parent?.lookupDefinition(name)
            if (parentRes) {
                return parentRes;
            }
            return identifier;
        }
        return identifier;
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
        const identifiers = this.identifierMap.entries();
        Array.from(identifiers).forEach(([name, identifier]) => {
            result.push(`${indent}  ${name} -> ${printNode(identifier)}`);
        });
        this.children.forEach(child => {
            child.toString(depth + 1, result);
        });
        return result.join('\n');
    }

    addReference(name: string, reference: ParserRuleContext) {
        if (!this.referenceMap.has(name)) {
            this.referenceMap.set(name, []);
        }
        this.referenceMap.get(name)!.push(reference);
    }

    getScopeByIdentifier(name: string): IdentifierScope | null {
        if (this.identifierMap.has(name)) {
            return this;
        }
        if (this.parent) {
            return this.parent.getScopeByIdentifier(name);
        }
        return null;
    }

    getReferencesByName(name: string): ParserRuleContext[] {
        const references = this.referenceMap.get(name);
        if (references) {
            return references;
        }
        return [];
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
                    manager.currentContext?.addIdentifier(cteName, cte);
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

            enterTableSource = (ctx: TableSourceContext) => {
                const tableName = ctx.tableOrView().tableName()?.getText();
                if (tableName) {
                    manager.currentContext?.addReference(tableName, ctx);
                }
            };

            enterColumnName = (ctx: ColumnNameContext) => {
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

    const alias = context.id_()?.getText();
    if (alias) {
        currentContext.addIdentifier(
            context.id_()?.getText() || '',
            context
        );
    }
    const tableName = context.tableOrView()?.getText();
    if (tableName) {
        currentContext.addIdentifier(tableName, context);
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
    currentContext.addIdentifier(name || '', subQuerySource);
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
    currentContext.addIdentifier(name || '', virtualTableSource);
    return virtualTableSource;
}
