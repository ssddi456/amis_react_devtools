import { ParseTree, TerminalNode, RuleContext, ParserRuleContext } from "antlr4ng";
import { HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";

export function matchType(node: ParseTree, ruleIndex: number | string): boolean {
    if (ruleIndex === '*') {
        return true;
    }
    if (node instanceof TerminalNode) {
        if (typeof ruleIndex === 'string') {
            return node.symbol.type === HiveSqlParser[`KW_${ruleIndex.toUpperCase()}` as keyof typeof HiveSqlParser]
                || node.symbol.type === HiveSqlParser[ruleIndex as keyof typeof HiveSqlParser];
        }
        return node.symbol.type === ruleIndex;
    }
    ruleIndex = (typeof ruleIndex === 'string'
        ? (HiveSqlParser[`RULE_${ruleIndex}` as keyof typeof HiveSqlParser] || -1)
        : ruleIndex) as number;

    if (node instanceof RuleContext) {
        return node.ruleIndex === ruleIndex;
    }
    return false;
}

// from buttom to top
export function matchSubPath(node: ParseTree, ruleIndex: number[] | string[]): ParseTree | null {
    const checkedRuleIndex = ruleIndex.slice(0);
    let parent: ParseTree | null = node.parent;

    if (checkedRuleIndex[0] === '*') {
        const nextRule = checkedRuleIndex[1];
        if (nextRule === '*' || nextRule === '?') {
            throw new Error(`'*' or '?' should not be used after '*' in ruleIndex: ${ruleIndex}`);
        }
        while (parent) {
            if (matchType(parent, nextRule)) {
                break;
            }
            parent = parent.parent;
        }
        if (!parent) {
            return null;
        }
        checkedRuleIndex.shift();
    } else if (!matchType(node, checkedRuleIndex[0])) {
        return null;
    }
    checkedRuleIndex.shift();
    while (checkedRuleIndex.length > 0 && parent) {
        if (checkedRuleIndex[0] === '?') {
            const nextRule = checkedRuleIndex[1];
            if (!nextRule) {
                return parent;
            }
            parent = parent?.parent || null;
            checkedRuleIndex.shift();
            continue;
        }
        if (checkedRuleIndex[0] === '*') {
            const nextRule = checkedRuleIndex[1];
            if (nextRule === '*' || nextRule === '?') {
                throw new Error(`'*' or '?' should not be used after '*' in ruleIndex: ${ruleIndex}`);
            }
            while (parent) {
                if (matchType(parent, nextRule)) {
                    break;
                }
                parent = parent.parent;
            }
            if (!parent) {
                return null;
            }
            checkedRuleIndex.shift();
        }
        if (!matchType(parent, checkedRuleIndex[0])) {
            return null;
        }
        const nextRule = checkedRuleIndex[1];
        if (!nextRule) {
            break;
        }
        parent = parent.parent;
        checkedRuleIndex.shift();
    }
    return parent;
}


export function matchSubPathOneOf(
    node: ParseTree,
    ruleIndexs: (number[] | string[])[],
): ParseTree | null {
    for (const ruleIndex of ruleIndexs) {
        const matched = matchSubPath(node, ruleIndex);
        if (matched) {
            console.debug(`[Matched ruleIndexs]: ${ruleIndex.join('->')} for node: ${node.getText()}`);
            return matched;
        }
    }
    console.debug(`[Matched ruleIndexs]: No match for node: ${node.getText()} with ruleIndexs: ${ruleIndexs.map(x => x.join('->')).join(', ')}`);
    return null;
}
