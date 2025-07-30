import { Position } from "monaco-editor";
import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { HiveSqlParserVisitor } from "dt-sql-parser";
import { HiveSqlParser, ProgramContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { WordPosition } from "dt-sql-parser/dist/parser/common/textAndWord";
import { IRange } from "monaco-sql-languages/esm/fillers/monaco-editor-core";

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

export function isPosInParserRuleContext(position: Position, context: ParserRuleContext | TerminalNode): boolean {
    const lineNumber = position.lineNumber;
    const column = position.column - 1;

    if (context instanceof TerminalNode) {
        if (context.symbol.type === HiveSqlParser.Identifier) {
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
    let endColumn = endToken.column;

    if (context.ruleIndex === HiveSqlParser.RULE_id_) {
        endColumn = startColumn + (context.getText ? context.getText().length : 0);
    }

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


function ruleIndexToDisplayName(node: ParserRuleContext | TerminalNode): string | undefined {
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

export function printNode(node: ParserRuleContext | TerminalNode | null): string {
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

export function printNodeTree(node: ParserRuleContext | null): string {
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
    }).join('\n');
}

export function rangeFromNode(node: ParserRuleContext) {
    const ret = {
        startLineNumber: (node.start?.line || -1),
        startColumn: (node.start?.column || -1) + 1,
        endLineNumber: (node.stop?.line || -1),
        endColumn: (node.stop?.column || -1) + 1,
    };
    if (node.ruleIndex === HiveSqlParser.RULE_id_) {
        ret.endColumn = ret.startColumn + (node.getText ? node.getText().length : 0);
    }
    return ret;
}

export function findTokenAtPosition(
    position: Position,
    tree: ProgramContext
): ParserRuleContext | null {
    let foundNode: any = null;
    const visitor = new class extends HiveSqlParserVisitor<any> {
        visit(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visit', JSON.stringify(position), printNode(foundNode));
            }
            return super.visit(tree);
        }

        visitChildren(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visitChildren +', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitChildren(node);
        }

        visitTerminal(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visitTerminal +', JSON.stringify(position), printNode(foundNode));
            } else {
                // console.log('visitTerminal -', JSON.stringify(position), printNode(node));
            }
            return super.visitTerminal(node);
        }

        visitErrorNode(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visitErrorNode', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitErrorNode(node);
        }
    };

    visitor.visit(tree);
    if (!foundNode) {
        console.warn('No node found at position:', JSON.stringify(position), 'tree:', tree);
    } else {
        console.log(
            'Found node at position:', JSON.stringify(position),
            'Node:', printNode(foundNode),
        );
    }
    return foundNode;
}
