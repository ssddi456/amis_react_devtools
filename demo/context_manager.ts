
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import { ExpressionContext, FromSourceContext, JoinSourceContext, ProgramContext, QueryStatementExpressionContext, SelectStatementWithCTEContext, SubQuerySourceContext, TableSourceContext, VirtualTableSourceContext, WithClauseContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-editor";
import { posInRange } from "./ls_helper";

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class IdentifierScope {
    uuid = uuidv4();
    indentifierMap: Map<string, ParserRuleContext> = new Map();
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
            endColumn: this.context.stop!.column
        };
    }

    addIdentifier(name: string, alias: string | undefined, identifier: ParserRuleContext) {
        if (identifier && identifier.start && identifier.stop) {
            this.indentifierMap.set(identifier.getText(), identifier);
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

    containsPosition(position: Position): boolean {
        if (!this.range) {
            return false;
        }
        return posInRange(position, this.range);
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
                    tableInfoFromTableSource(
                        manager.currentContext,
                        atomjoinSource.tableSource()
                    );
                    tableInfoFromSubQuerySource(
                        manager.currentContext,
                        atomjoinSource.subQuerySource()
                    );
                    tableInfoFromVirtualTableSource(
                        manager.currentContext,
                        atomjoinSource.virtualTableSource()
                    );

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
        };

        ParseTreeWalker.DEFAULT.walk(listener, tree);
    }

    getContextByPosition(position: Position): IdentifierScope | null {
        if (!this.currentContext) {
            return null;
        }
        let checkNodes: IdentifierScope[] = [this.currentContext];
        while (true) {
            let foundNode = false;
            for (const child of checkNodes) {
                if (child.containsPosition(position)) {
                    foundNode = true;
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

        return null;
    }
}


export const createContextManager = (tree: ProgramContext) => {
    return new ContextManager(tree);
};


function tableInfoFromTableSource(
    currentContext: IdentifierScope | null,
    context: TableSourceContext | null,
): void {
    if (!currentContext || !context) {
        return;
    }
    currentContext.addIdentifier(
        context.tableOrView().tableName()?.getText() || '',
        context.id_()?.getText() || '',
        context
    );
}

const localDbId = 'local db';

function tableInfoFromSubQuerySource(
    currentContext: IdentifierScope | null,
    subQuerySource: SubQuerySourceContext | null,
): void {
    if (!currentContext || !subQuerySource) {
        return;
    }
    const name = subQuerySource.id_()?.getText();
    currentContext.addIdentifier(name || '', undefined, subQuerySource);
}

function tableInfoFromVirtualTableSource(
    currentContext: IdentifierScope | null,
    virtualTableSource: VirtualTableSourceContext | null,
): void {
    if (!currentContext || !virtualTableSource) {
        return;
    }
    const alias = virtualTableSource.tableAlias()?.getText();
    currentContext.addIdentifier(alias || '', undefined, virtualTableSource);
}
