import { ParseTree } from "antlr4ng";
import { HiveSQL, HiveSqlParserVisitor } from "dt-sql-parser";
import { JoinSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { hive, formatDialect } from "sql-formatter";
import { Position } from "vscode-languageserver-types";

const getEdits = (tree: ParseTree) => {
    const injectNewLinePositions: Position[] = [];

    const visitor = new class extends HiveSqlParserVisitor<any> {
        // Override methods to customize behavior
        visitJoinSource = (ctx: JoinSourceContext) => {
            const keywordOns = ctx.KW_ON();
            keywordOns.forEach((kwOn) => {
                injectNewLinePositions.push({
                    line: kwOn.symbol.line,
                    character: kwOn.symbol.column
                });
            });
            // Custom logic for join source
            return this.visitChildren(ctx);
        }
    };
    visitor.visit(tree);

    return injectNewLinePositions.reverse();
};

export const formatHiveSQL = (sql: string): string => {
    const formatted = formatDialect(sql, {
        dialect: {
            ...hive,
            formatOptions: {
                ...hive,
                onelineClauses: [
                    ...hive.formatOptions.onelineClauses,
                    'ON '
                ],
            }
        },
        tabWidth: 4,
        useTabs: false,
        keywordCase: 'upper',
        identifierCase: 'lower',
        dataTypeCase: 'upper',
        functionCase: 'lower',
        indentStyle: 'standard',
        logicalOperatorNewline: 'before',
        expressionWidth: 80,
        linesBetweenQueries: 1,
        denseOperators: false,
        newlineBeforeSemicolon: false,
        params: [],
        paramTypes: {},
    });
    const hiveSqlParse = new HiveSQL();
    const ctx = hiveSqlParse.createParser(formatted);
    const tree = ctx.program();
    const edits = getEdits(tree);
    const lines = formatted.split('\n');
    return lines.map((line, index) => {
        const curLineEdits = edits.filter(e => e.line === index + 1);
        curLineEdits.sort((a, b) => a.character - b.character);
        if (curLineEdits.length > 0) {
            const segs: string[] = [];
            for (let i = 0; i < curLineEdits.length; i++) {
                const edit = curLineEdits[i];
                if (i === 0) {
                    segs.push(line.slice(0, edit.character));
                } else {
                    segs.push(line.slice(curLineEdits[i - 1].character, edit.character));
                }
            }
            const indents = line.match(/^\s*/)?.[0] || '';
            segs.push(line.slice(curLineEdits[curLineEdits.length - 1].character));
            return segs.join('\n' + indents);
        }
        return line;
    }).join('\n');
};