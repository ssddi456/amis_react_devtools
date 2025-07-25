import { IRange, languages, type IMarkdownString, Position } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContext, EntityContextType, HiveSQL, HiveSqlParserVisitor } from 'dt-sql-parser';
import { AttrName } from 'dt-sql-parser/dist/parser/common/entityCollector';
import { posInRange } from "./ls_helper";
import { TextSlice, WordRange } from "dt-sql-parser/dist/parser/common/textAndWord";
import { ProgramContext, HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext } from "antlr4ng";
import tableData from './data/example'

function sliceToRange(slice: {
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

function wordToRange(slice?: WordRange): IRange | undefined {
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

function isPosInParserRuleContext(position: Position, context: {
    start: {
        line: number;
        column: number;
    } | null;
    stop: {
        line: number;
        column: number;
    } | null;
    ruleIndex: number;
    getText?(): string;
}): boolean {
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

    if (position.lineNumber === startLine && position.column >= startColumn && position.lineNumber === endLine && position.column <= endColumn) {
        return true;
    }

    if (position.lineNumber === startLine && position.lineNumber !== endLine && position.column >= startColumn) {
        return true;
    }

    if (position.lineNumber !== startLine && position.lineNumber === endLine && position.column <= endColumn) {
        return true;
    }

    if (position.lineNumber > startLine && position.lineNumber < endLine) {
        return true;
    }
    return false;
}

function printNode(node: ParserRuleContext | null): string {
    if (!node) {
        return 'null';
    }
    const range = rangeFromNode(node);
    const start = `${range.startLineNumber}:${range.startColumn}`;
    const end = `${range.endLineNumber}:${range.endColumn}`;

    return `Node(${ruleIndexToDisplayName(node.ruleIndex)}, ${start} -> ${end})`;
}

function rangeFromNode(node: ParserRuleContext) {
    const ret = {
        startLineNumber: node.start!.line,
        startColumn: node.start!.column + 1,
        endLineNumber: node.stop!.line,
        endColumn: node.stop!.column + 1,
    };
    if (node.ruleIndex === HiveSqlParser.RULE_id_) {
        ret.endColumn = ret.startColumn + (node.getText ? node.getText().length : 0);
    }
    return ret;
}

function findTokenAtPosition(
    position: Position,
    tree: ProgramContext
): ParserRuleContext | null {
    let foundNode: any = null;
    const visitor = new class extends HiveSqlParserVisitor<any> {
        visit(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visit', JSON.stringify(position), printNode(foundNode));
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
                console.log('visitTerminal', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitTerminal(node);
        }

        visitErrorNode(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visitErrorNode', JSON.stringify(position), printNode(foundNode));
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

interface TableInfo {
    db_name: string;
    table_name: string;
    table_id: number;
    description: string;
    column_list: ColumnInfo[];
}

interface ColumnInfo {
    column_name: string;
    data_type_string: string;
    description: string;
}

function getTableInfoByName(tableName: string): TableInfo | null {
    if (!tableName) {
        return null;
    }
    const tableInfo = tableData.find(t => t.table_name === tableName);
    return tableInfo || null;
}

function getColumnInfoByName(tableName: string, columnName: string) {
    if (!tableName || !columnName) {
        return null;
    }
    const tableInfo = getTableInfoByName(tableName);
    if (!tableInfo) {
        return null;
    }
    const columnInfo = tableInfo.column_list.find(c => c.column_name === columnName);

    return columnInfo || null;
}

function penddingSliceText(slice: TextSlice, full: string): string {
    const text = slice.text;
    if (slice.startIndex > 1) {
        const before = full.slice(0, slice.startIndex).replace(/[^\n]/g, ' ');
        return before + text;
    }
    return text
}

function ruleIndexToDisplayName(ruleIndex: number): string | undefined {
    const ruleNames = HiveSqlParser.ruleNames;
    if (ruleIndex >= 0 && ruleIndex < ruleNames.length) {
        return ruleNames[ruleIndex];
    }
    return undefined;
}



const noTableInfoRes = (text: string, range: IRange) => ({
    contents: [
        {
            value: `table not found: ${text}`
        },
    ],
    range,
});
const noColumnInfoRes = (table: TableInfo, columnName: string, range: IRange) => ({
    contents: [
        {
            value: `column: ${columnName} not found in table ${table.table_name}`
        },
    ],
    range,
});
const tableAndColumn = (table: TableInfo, column: ColumnInfo, range: IRange) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description,
                `**Column:** ${column.column_name} [${column.data_type_string}]`,
                column.description
            ].filter(Boolean).join('\n\n'), 
        },
    ],
    range,
});
const tableRes = (table: TableInfo, range: IRange) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description
            ].filter(Boolean).join('\n\n')
        },
    ],
    range,
});


function findTableInfoById(tableIdExp: string, tableEntities: EntityContext[]) {
    if (!tableIdExp || !tableEntities || tableEntities.length === 0) {
        return null;
    }

    for (const entity of tableEntities) {
        if (entity[AttrName.alias]?.text === tableIdExp || entity.text === tableIdExp) {
            return entity.text;
        }
    }

    return null;
}


function matchSubTree(node: ParserRuleContext, ruleIndex: number[]): boolean {
    const checkedRuleIndex = ruleIndex.slice(0).reverse();
    if (node.ruleIndex === checkedRuleIndex[0]) {
        return true;
    }
    let parent = node.parent;
    while (checkedRuleIndex.length > 0 && parent) {
        if (parent.ruleIndex !== checkedRuleIndex[0]) {
            return false;
        }
        parent = parent.parent;
        checkedRuleIndex.shift();
    }
    return true;
}

// 这里列一下表

export const getHiveType = (model: {
    uri: { toString: () => string; };
    getValue: () => string;
}) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(document.getText());

    const getCtxFromPos = (position: Position) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return null;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                const text = penddingSliceText(slice, document.getText());
                console.log('getCtxFromPos text', '-->' + text + '<--');
                const ctx = hiveSqlParse.createParser(document.getText());
                const tree = ctx.program();
                const foundNode = findTokenAtPosition(position, tree);
                return foundNode;
            }
        }
        return null;
    };

    return {
        doComplete: (position: Position) => {
            getCtxFromPos(position);
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;

            console.log('do completes syntaxSuggestions', syntaxSuggestions);
            if (!syntaxSuggestions) {
                return;
            }

            const table = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.TABLE);
            if (table) {
                // 这里搞一下找表名
            }
            const column = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.COLUMN);
            if (column) {
                const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
                const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);
                console.log("do completes currentEntities", currentEntities);
                if (currentEntities.length > 0
                    && currentEntities[0].entityContextType === EntityContextType.TABLE
                ) {
                    const cursorRange = {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    };
                    let range = wordToRange(column.wordRanges[0]) || cursorRange;
                    // check if is table_name.column_name
                    if (column.wordRanges[1]?.text === '.') {
                        if (column.wordRanges[2]) {
                            range = wordToRange(column.wordRanges[2])!;
                        } else {
                            range = {
                                startLineNumber: position.lineNumber,
                                startColumn: position.column + 1,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column + 1
                            };
                        }
                    }
                    console.log("do completes range", range);
                    return {
                        suggestions: [
                            {
                                label: `column test`,
                                sortText: '$$test',
                                kind: languages.CompletionItemKind.Field,
                                insertText: 'test',
                                range,
                                documentation: {
                                    value: [
                                        `**Table:** ${currentEntities[0].text}`,
                                        `**Column:** test`
                                    ].join('\n\n'),
                                    isTrusted: true
                                } as IMarkdownString
                            }
                        ]
                    };
                }
            }
        },
        doHover: (
            position: Position,
        ) => {
            const foundNode = getCtxFromPos(position);
            if (!foundNode || (
                matchSubTree(foundNode, [HiveSqlParser.RULE_id_])

                && !matchSubTree(foundNode., [HiveSqlParser.RULE_columnNamePath])
                && !matchSubTree(foundNode, [HiveSqlParser.RULE_poolPath])
                && !matchSubTree(foundNode, [HiveSqlParser.RULE_constant])
            )) {
                return;
            }

            const parent = foundNode.parent!;
            const parentRuleName = ruleIndexToDisplayName(parent.ruleIndex);
            const currentRuleName = ruleIndexToDisplayName(foundNode.ruleIndex);
            const parentParentRuleName = ruleIndexToDisplayName(parent.parent?.ruleIndex || -1);
            console.log(parentParentRuleName, '->', parentRuleName, '-> *', currentRuleName);

            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
            const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);

            console.log('do hover syntaxSuggestions', printNode(parent), position, syntaxSuggestions, currentEntities);

            if (parent.ruleIndex === HiveSqlParser.RULE_tableSource) {
                const tableIdExp = parent.children![0].getText();
                const tableInfo = getTableInfoByName(tableIdExp);
                if (!tableInfo) {
                    return noTableInfoRes(tableIdExp, rangeFromNode(foundNode));
                }
                const range = rangeFromNode(foundNode);
                return tableRes(tableInfo, range);
            }
            if (parent.ruleIndex === HiveSqlParser.RULE_tableName) {
                const tableIdExp = parent.children![0].getText();
                const tableInfo = getTableInfoByName(tableIdExp);
                console.log('do hover tableName', parent, 'tableIdExp', tableIdExp, 'tableInfo', tableInfo);
                if (!tableInfo) {
                    return noTableInfoRes(tableIdExp, rangeFromNode(foundNode));
                }
                const range = rangeFromNode(foundNode);
                return tableRes(tableInfo, range);
            }
            if (parent.ruleIndex === HiveSqlParser.RULE_viewName) {
                console.log('do hover tableSource', parent);
                return;
            }

            // columnName -> poolPath -> id_(from default table name)
            // columnName -> poolPath -> id_(table name or alias), ., _id
            if (
                parent.ruleIndex === HiveSqlParser.RULE_poolPath
                && (
                    parent.parent?.ruleIndex === HiveSqlParser.RULE_columnName
                    || parent.parent?.ruleIndex === HiveSqlParser.RULE_columnNamePath
                )
            ) {
                const tableIdExp = parent.children?.length === 1 ? undefined : parent.children![0].getText();
                const columnName = parent.children?.length === 1 ? parent.children![0].getText() : parent.children![2].getText();
                const range = rangeFromNode(foundNode);

                if (!tableIdExp) {
                    const tableInfo = getTableInfoByName(currentEntities[0].text)
                    if (!tableInfo) {
                        return noTableInfoRes(currentEntities[0].text, range);
                    }
                    const columnInfo = getColumnInfoByName(currentEntities[0].text, columnName);
                    if (!columnInfo) {
                        return noColumnInfoRes(tableInfo, columnName, range);
                    }
                    return tableAndColumn(tableInfo, columnInfo, range);
                }
                const realTableName = findTableInfoById(tableIdExp, currentEntities.filter(e => e.entityContextType === EntityContextType.TABLE));
                if (!realTableName) {
                    return noTableInfoRes(tableIdExp, range);
                }
                const tableInfo = getTableInfoByName(realTableName);
                if (!tableInfo) {
                    return noTableInfoRes(realTableName, range);
                }
                const columnInfo = getColumnInfoByName(tableIdExp, columnName);
                if (!columnInfo) {
                    return noColumnInfoRes(tableInfo, columnName, range);
                }
                return tableAndColumn(tableInfo, columnInfo, range);
            }



            if (syntaxSuggestions) {
                const table = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.TABLE);
                if (table) {
                    const tableInfo = getTableInfoByName(currentEntities[0].text)
                    if (!tableInfo) {
                        return {
                            contents: [
                                {
                                    value: `table not found: ${currentEntities[0].text}`
                                },
                            ],
                            range: wordToRange(table.wordRanges[0])
                        };
                    }
                    // find table in 
                    return {
                        contents: [
                            {
                                value: `**Table:** ${table.wordRanges[0].text}`
                            },
                        ],
                        range: wordToRange(table.wordRanges[0])
                    };
                }
            }


            // tableName look up
        },
        doValidation() {
            const errors = hiveSqlParse.validate(document.getText());
            if (errors.length === 0) {
                return [];
            }
            return errors.map(err => {
                return {
                    message: err.message,
                    range: sliceToRange(err)
                };
            });
        }
    };
}
