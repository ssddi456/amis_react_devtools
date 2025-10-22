import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import { HiveSqlParserVisitor } from "dt-sql-parser";
import { AtomExpressionContext, ColumnNameContext, ColumnNamePathContext, CteStatementContext, ExpressionContext, FromClauseContext, HiveSqlParser, Id_Context, JoinSourcePartContext, PoolPathContext, RollupOldSyntaxContext, SubQuerySourceContext, TableNameContext, TableSourceContext, VirtualTableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { matchSubPathOneOf } from "./tree_query";
import { IdentifierScope } from "../identifier_scope";
import { ColumnInfo } from "../types";
import { isPosInParserRuleContext, Pos } from "./pos";

export function findTokenAtPosition(
    position: Pos,
    tree: ParserRuleContext
): ParserRuleContext | null {
    let foundNode: any = null;
    const visitor = new class extends HiveSqlParserVisitor<any> {
        visit(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visit', JSON.stringify(position), printNode(foundNode));
                return super.visit(tree);
            }
        }

        visitChildren(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visitChildren +', JSON.stringify(position), printNode(foundNode));
                return super.visitChildren(node);
            }
        }

        visitTerminal(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visitTerminal +', JSON.stringify(position), printNode(foundNode));
                return super.visitTerminal(node);
            }
        }

        visitErrorNode(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visitErrorNode', JSON.stringify(position), printNode(foundNode));
                return super.visitErrorNode(node);
            }
        }
    };

    visitor.visit(tree);
    if (!foundNode) {
        // console.warn('No node found at position:', JSON.stringify(position), 'tree:', tree, rangeFromNode(tree));
    } else {
        // console.log(
        //     'Found node at position:', JSON.stringify(position),
        //     'Node:', printNode(foundNode),
        // );
    }
    return foundNode;
}

export function isKeyWord(node: ParseTree, key: string): boolean {
    if (node instanceof TerminalNode) {
        return node.symbol.type === HiveSqlParser[`KW_${key.toUpperCase()}` as keyof typeof HiveSqlParser];
    }
    return false;
}


export function getOnConditionOfFromClause(fromClause: FromClauseContext): ParserRuleContext[] | null {
    const fromSource = fromClause.fromSource();
    const joinSources = fromSource.joinSource();
    if (!joinSources) {
        return null;
    }

    const ret: ParserRuleContext[] = [];
    const children = joinSources.children || [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const nextToken = children[i + 1];
        if (isKeyWord(child, 'ON') && nextToken instanceof ParserRuleContext) {
            ret.push(nextToken);
        }
        if (isKeyWord(child, 'USING') && nextToken instanceof ParserRuleContext) {
            ret.push(nextToken);
        }
    }
    return ret.length > 0 ? ret : null;
}

export function getColumnInfoFromNode(sourceColumn: ColumnNameContext | ColumnNamePathContext, alias?: Id_Context): ColumnInfo {
    if (alias) {
        return {
            exportColumnName: alias.getText(),
            referenceColumnName: columnNameFromColumnPath(sourceColumn),
            referenceTableName: tableNameFromColumnPath(sourceColumn),
            reference: sourceColumn,
            defineReference: alias,
        }
    } else {
        const columnNameText = columnNameFromColumnPath(sourceColumn);
        return {
            exportColumnName: columnNameText,
            referenceColumnName: columnNameText,
            referenceTableName: tableNameFromColumnPath(sourceColumn),
            reference: sourceColumn,
            defineReference: sourceColumn
        };
    }
}


export function tableInfoFromTableSource(
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
        currentContext.getMrScope()?.addInputTable(tableName, context, context.tableOrView()!);
    }

    return context;
}

export function tableInfoFromSubQuerySource(
    currentContext: IdentifierScope | null,
    subQuerySource: SubQuerySourceContext | null,
): SubQuerySourceContext | null {
    if (!currentContext || !subQuerySource) {
        return null;
    }
    const name = subQuerySource.id_().getText();
    currentContext.addIdentifier(name || '', subQuerySource, true);
    currentContext.getMrScope()?.addInputTable(name || '', subQuerySource, subQuerySource.id_()!);
    currentContext.addHighlightNode(subQuerySource.id_());

    return subQuerySource;
}

export function tableInfoFromVirtualTableSource(
    currentContext: IdentifierScope | null,
    virtualTableSource: VirtualTableSourceContext | null,
): VirtualTableSourceContext | null {
    if (!currentContext || !virtualTableSource) {
        return null;
    }
    const name = virtualTableSource.tableAlias().getText();
    currentContext.addIdentifier(name || '', virtualTableSource, true);
    currentContext.getMrScope()?.addInputTable(name || '', virtualTableSource, virtualTableSource.tableAlias()!);
    currentContext.addHighlightNode(virtualTableSource.tableAlias());

    return virtualTableSource;
}

export function tableInfoFromCteStatement(
    currentContext: IdentifierScope | null,
    cteStatement: CteStatementContext | null,
): CteStatementContext | null {
    if (!currentContext || !cteStatement) {
        return null;
    }
    const name = cteStatement.id_().getText();
    currentContext.addIdentifier(name || '', cteStatement, true);
    currentContext.getMrScope()?.addTableDefinition(name || '', cteStatement, cteStatement.id_()!);
    currentContext.addHighlightNode(cteStatement.id_());

    return cteStatement;
}

export function getNextOnExpression(children: ParseTree[], current: JoinSourcePartContext): ParserRuleContext | null {
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


export function getNextUsingExpression(children: ParseTree[], current: JoinSourcePartContext): ParserRuleContext | null {
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

export function getNextUsingKeyword(children: ParseTree[], current: JoinSourcePartContext): TerminalNode | null {
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
            return children[i] as TerminalNode;
        }
    }
    return null
}

export function tableNameFromColumnPath(ctx: ColumnNameContext): string {
    const ids = ctx.poolPath()?.id_();
    if (ids?.length == 1) {
        return '';
    }
    if ((ids?.length || 0) > 1) {
        return ids ? ids[ids.length - 2]?.getText() : '';
    }
    return '';
}

export function columnNameFromColumnPath(ctx: ColumnNameContext): string {
    const ids = ctx.poolPath()?.id_();
    return ids ? ids[ids.length - 1]?.getText() : '';
}

export function getColumnNameFromExpressionOrDefault(ctx: ParserRuleContext): ColumnNameContext | ColumnNamePathContext | null {
    while (ctx.children?.length == 1) {
        ctx = ctx.children[0] as ParserRuleContext;
        if (ctx instanceof ColumnNameContext || ctx instanceof ColumnNamePathContext) {
            return ctx;
        }
    }
    return null
}

export function getColumnsFromRollupOldSyntax(ctx: RollupOldSyntaxContext): ColumnInfo[] {
    const columns: ColumnInfo[] = [];
    const expressions = ctx.expressionsNotInParenthesis().expressionOrDefault();
    expressions?.forEach((expr) => {
        const columnName = getColumnNameFromExpressionOrDefault(expr);
        if (columnName) {
            const columnInfo = getColumnInfoFromNode(columnName);
            columns.push(columnInfo);
        }
    });
    return columns;
}

export function isSameColumnInfo(columnInfo1: ColumnInfo, columnInfo2: ColumnInfo): boolean {
    return columnInfo1.referenceTableName === columnInfo2.referenceTableName &&
        columnInfo1.referenceColumnName === columnInfo2.referenceColumnName;
}

export function getAtomExpressionFromExpression(ctx: ParserRuleContext): AtomExpressionContext | null {
    if (!(ctx instanceof ExpressionContext)) {
        return null;
    }
    while (ctx.children?.length == 1) {
        ctx = ctx.children[0] as ParserRuleContext;
        if (ctx instanceof AtomExpressionContext) {
            return ctx;
        }
    }
    return null
}

export function getFunctionCallFromExpression(ctx: ParserRuleContext): ParserRuleContext | null {
    const atom = getAtomExpressionFromExpression(ctx);
    if (!atom) {
        return null;
    }
    const func = atom.function_();
    return func;
}

export function tableIdAndColumnNameFromPoolPath(poolPath: ParserRuleContext | null): { tableId: string | undefined; columnName: string } {
    if (!poolPath) {
        return { tableId: undefined, columnName: '' };
    }
    const segs = poolPath.children?.map(c => c.getText()) || [];
    const tableId = segs.length === 1 ? undefined : segs[0];
    const columnName = segs.length === 1 ? segs[0] : segs[2];
    return { tableId, columnName };
}

export function getTableNameFromTableName(context: TableNameContext | null): { tableId: string, dbName?: string } {
    if (!context) {
        return { tableId: '', dbName: undefined };
    }

    const segs = context.children?.map(c => c.getText()) || [];
    const tableId = segs.length === 1 ? segs[0] : segs[2] ;
    const dbName = segs.length === 1 ? undefined : segs[2];
    return { tableId, dbName };
}

export function getTableNameFromContext(context: ParserRuleContext): { tableId: string, dbName?: string } {
    if (context instanceof TableSourceContext) {
        const tableOrView = context.tableOrView();
        if (!tableOrView) {
            return { tableId: '', dbName: undefined };
        }
        const tableName = tableOrView.tableName();
        if (!tableName) {
            return { tableId: '', dbName: undefined };
        }
        return getTableNameFromTableName(tableName);
    }

    if (context instanceof ColumnNameContext || context instanceof ColumnNamePathContext) {
        const { tableId } = tableIdAndColumnNameFromPoolPath(context.poolPath());
        return { tableId: tableId || '', dbName: undefined };
    }

    if (context instanceof TableNameContext) {
        return getTableNameFromTableName(context);
    }


    if (context instanceof VirtualTableSourceContext) {
        const tableAlias = context.tableAlias();
        if (!tableAlias) {
            return { tableId: '', dbName: undefined };
        }
        return { tableId: tableAlias.getText(), dbName: undefined };
    }

    if (matchSubPathOneOf(context, [
        ['id_', 'subQuerySource'],
        ['id_', 'cteStatement'],
        ['id_', 'tableSource']
    ])) {
        return { tableId: context.getText(), dbName: undefined };
    }

    return { tableId: '', dbName: undefined };
}