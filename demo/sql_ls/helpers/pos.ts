import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { matchSubPath } from "./tree_query";

export interface Pos {
    lineNumber: number;
    column: number;
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

export function isPosInParserRuleContext(position: Pos, context: ParserRuleContext | TerminalNode): boolean {
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
                && context.symbol.column + (context.symbol.text || '').length >= column) {
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

    if (lineNumber === startLine && column >= startColumn && lineNumber === endLine && column <= endColumn) {
        return true;
    }

    if (lineNumber === startLine && lineNumber !== endLine && column >= startColumn) {
        return true;
    }

    if (lineNumber !== startLine && lineNumber === endLine && column <= endColumn) {
        return true;
    }

    if (lineNumber > startLine && lineNumber <= endLine) {
        return true;
    }
    return false;
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

export function posInRange(pos: Pos, range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; }) {
    return pos.lineNumber >= range.startLineNumber &&
        pos.lineNumber <= range.endLineNumber &&
        (pos.lineNumber > range.startLineNumber || pos.column >= range.startColumn) &&
        (pos.lineNumber < range.endLineNumber || pos.column <= range.endColumn + 1);
}

export function positionFromNode(node: ParserRuleContext | TerminalNode): Pos {
    if (node instanceof ParserRuleContext) {
        return {
            lineNumber: (node.start?.line || -1),
            column: (node.start?.column || -1) + 1,
        };
    }

    return {
        lineNumber: (node.symbol.line || -1),
        column: (node.symbol.column || -1) + 1,
    };
}