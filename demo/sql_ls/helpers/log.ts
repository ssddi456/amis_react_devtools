import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { rangeFromNode } from "./table_and_column";
import type { WithSource } from "../util";

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

export const logSource = (arg: any) => {
    if (arg && '__source' in arg) {
        const source = (arg as WithSource<{}>).__source!;
        console.log(`vscode://file/${source.fileName}%3A${source.lineNumber}%3A${source.columnNumber}`);
    }
    console.log(arg);
};