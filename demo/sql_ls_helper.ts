import { Position } from "monaco-editor";
import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import { HiveSqlParserVisitor } from "dt-sql-parser";
import { AtomExpressionContext, ColumnNameContext, ColumnNamePathContext, CteStatementContext, ExpressionContext, ExpressionOrDefaultContext, FromClauseContext, Function_Context, HiveSqlParser, Id_Context, JoinSourcePartContext, ProgramContext, RollupOldSyntaxContext, SubQuerySourceContext, TableSourceContext, VirtualTableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { WordPosition } from "dt-sql-parser/dist/parser/common/textAndWord";
import { IRange } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { matchSubPath } from "./sql_tree_query";
import { IdentifierScope } from "./Identifier_scope";

export interface TableSource {
    tableName: string;
    reference: ParserRuleContext,
    defineReference: ParserRuleContext
}

export interface ColumnInfo {
    exportColumnName: string;
    referanceTableName: string;
    referanceColumnName: string;
    reference: ParserRuleContext;
    defineReference: ParserRuleContext;
}


export function sliceToRange(slice: {
    readonly startLine: number;
    /** end at ..n */
    readonly endLine: number;
    /** start at 1 */
    readonly startColumn: number;
    /** end at ..n + 1 */
    readonly endColumn: number;
}) {
    return {
        startLineNumber: slice.startLine,
        startColumn: slice.startColumn,
        endLineNumber: slice.endLine,
        endColumn: slice.endColumn
    };
}

export function wordToRange(slice?: WordPosition): IRange | undefined {
    if (!slice) {
        return undefined;
    }
    return {
        startLineNumber: slice.line,
        startColumn: slice.startColumn,
        endLineNumber: slice.line,
        endColumn: slice.endColumn
    };
}

export function isPosInParserRuleContext(position: { lineNumber: number, column: number }, context: ParserRuleContext | TerminalNode): boolean {
    const lineNumber = position.lineNumber;
    const column = position.column - 1;

    if (context instanceof TerminalNode) {
        if (context.symbol.type === HiveSqlParser.Identifier) {
            return false;
        }
        if (matchSubPath(context, ['*', 'id_'])) {
            return false;
        }
        if (context.symbol.line === lineNumber) {
            if (context.symbol.column <= column
                && context.symbol.column + (context.symbol.text || '').length > column
            ) {
                return true;
            }
        }
        return false;
    }
    const startToken = context.start;
    const endToken = context.stop;
    if (!startToken || !endToken) {
        return false;
    }
    let startLine = startToken.line;
    let startColumn = startToken.column;
    let endLine = endToken.line;
    let endColumn = endToken.column + (endToken.text?.length || 0);

    if (lineNumber === startLine && column >= startColumn && lineNumber === endLine && column < endColumn) {
        return true;
    }

    if (lineNumber === startLine && lineNumber !== endLine && column >= startColumn) {
        return true;
    }

    if (lineNumber !== startLine && lineNumber === endLine && column < endColumn) {
        return true;
    }

    if (lineNumber > startLine && lineNumber < endLine) {
        return true;
    }
    return false;
}


export function ruleIndexToDisplayName(node: ParserRuleContext | TerminalNode): string | undefined {
    const symbolicNames = HiveSqlParser.symbolicNames;
    if (node instanceof TerminalNode) {
        if (node.symbol.type >= 0 && node.symbol.type < symbolicNames.length) {
            return symbolicNames[node.symbol.type] || `Unknown Symbol: ${node.symbol.type}`;
        }
        return node.getText();
    }
    const ruleNames = HiveSqlParser.ruleNames;
    const ruleIndex = node.ruleIndex;

    if (ruleIndex >= 0 && ruleIndex < ruleNames.length) {
        if (!ruleNames[ruleIndex]) {
            return `Unknown Rule: ${ruleIndex}`;
        }
        return ruleNames[ruleIndex];
    }
    return node.getText();
}

export function printNode(node: ParserRuleContext | TerminalNode | null | undefined): string {
    if (!node) {
        return 'null';
    }
    if (node instanceof TerminalNode) {
        return `TerminalNode(${ruleIndexToDisplayName(node)}, ${node.symbol.line}:${node.symbol.column})`;
    }
    const range = rangeFromNode(node);
    const start = `${range.startLineNumber}:${range.startColumn}`;
    const end = `${range.endLineNumber}:${range.endColumn}`;

    return `Node(${ruleIndexToDisplayName(node)}, ${start} -> ${end})`;
}

export function printChildren(node: ParserRuleContext | null): string {
    if (!node) {
        return 'null';
    }
    const children = node.children || [];
    return `Children: \n${(children as any[]).map(printNode).join(', \n')}`;
}

export function printNodeTree(node: ParserRuleContext | null, separator = '\n'): string {
    if (!node) {
        return 'null';
    }
    const result: string[] = [];
    while (true) {
        result.push(printNode(node));
        if (!node.parent) {
            break;
        }
        node = node.parent;
    }
    return result.reverse().map((x, i) => {
        if (i == 0) {
            return x;
        }
        return `  ->${x}`;
    }).join(separator);
}

export function rangeFromNode(node: ParserRuleContext | TerminalNode) {
    if (node instanceof ParserRuleContext) {

        const ret = {
            startLineNumber: (node.start?.line || -1),
            startColumn: (node.start?.column || -1) + 1,
            endLineNumber: (node.stop?.line || -1),
            endColumn: (node.stop?.column !== undefined ? (node.stop?.column + (node.stop?.text?.length || 0)) : -1) + 1,
        };
        if (node.ruleIndex === HiveSqlParser.RULE_id_) {
            ret.endColumn = ret.startColumn + (node.getText ? node.getText().length : 0);
        }
        return ret;
    }

    const ret = {
        startLineNumber: (node.symbol.line || -1),
        startColumn: (node.symbol.column || -1) + 1,
        endLineNumber: (node.symbol.line || -1),
        endColumn: (node.symbol.column !== undefined ? (node.symbol.column + (node.symbol.text?.length || 0)) : -1) + 1,
    };
    return ret;
    
}

export function findTokenAtPosition(
    position: Position,
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
        console.warn('No node found at position:', JSON.stringify(position), 'tree:', tree, rangeFromNode(tree));
    } else {
        console.log(
            'Found node at position:', JSON.stringify(position),
            'Node:', printNode(foundNode),
        );
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
            referanceColumnName: columnNameFromColumnPath(sourceColumn),
            referanceTableName: tableNameFromColumnPath(sourceColumn),
            reference: sourceColumn,
            defineReference: alias,
        }
    } else {
        const columnNameText = columnNameFromColumnPath(sourceColumn);
        return {
            exportColumnName: columnNameText,
            referanceColumnName: columnNameText,
            referanceTableName: tableNameFromColumnPath(sourceColumn),
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
        currentContext.addReference(tableName, context);
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
    if (name) {
        currentContext.addHighlightNode(subQuerySource.id_());
    }
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
    if (name) {
        currentContext.addHighlightNode(virtualTableSource.tableAlias());
    }
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
    currentContext.getMrScope()?.addInputTable(name || '', cteStatement, cteStatement.id_()!);
    if (name) {
        currentContext.addHighlightNode(cteStatement.id_());
    }
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
    return columnInfo1.referanceTableName === columnInfo2.referanceTableName &&
        columnInfo1.referanceColumnName === columnInfo2.referanceColumnName;
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