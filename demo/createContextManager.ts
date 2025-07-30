
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { HiveSqlParserListener } from "dt-sql-parser";
import { FromSourceContext, JoinSourceContext, ProgramContext, QueryStatementExpressionContext, SelectStatementWithCTEContext, SubQuerySourceContext, TableSourceContext, VirtualTableSourceContext, WithClauseContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class IdentifierScope {
    uuid = uuidv4();
    indentifierMap: Map<string, ParserRuleContext> = new Map();

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
            startLineNumber: this.context.start?.line,
            startColumn: this.context.start?.column,
            endLineNumber: this.context.stop?.line,
            endColumn: this.context.stop?.column
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
}

class ContextManager {
    identifierMap: Map<string, IdentifierScope> = new Map();
    currentContext: IdentifierScope | null = null;

    constructor(public tree: ProgramContext) {
        const manager = this;
        const listener = new class extends HiveSqlParserListener {
            enterQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
                const currentContext = new IdentifierScope(ctx, manager.currentContext);

                manager.identifierMap.set(currentContext.uuid, currentContext);
                manager.currentContext = currentContext;
            };
            exitQueryStatementExpression = (ctx: QueryStatementExpressionContext) => {
                if (manager.currentContext) {
                    manager.currentContext = manager.currentContext.parent;
                }
            };
            enterSelectStatementWithCTE = (ctx: SelectStatementWithCTEContext) => {
                const currentContext = new IdentifierScope(ctx, manager.currentContext);

                manager.identifierMap.set(currentContext.uuid, currentContext);
                manager.currentContext = currentContext;
            };
            exitSelectStatementWithCTE = (ctx: SelectStatementWithCTEContext) => {
                if (manager.currentContext) {
                    manager.currentContext = manager.currentContext.parent;
                }
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
                }
            }

        };

        ParseTreeWalker.DEFAULT.walk(listener, tree);
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
