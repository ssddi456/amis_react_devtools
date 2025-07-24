import { editor, languages, type IMarkdownString, Position } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContextType, HiveSQL, HiveSqlParserVisitor } from 'dt-sql-parser';
import { posInRange } from "./ls_helper";
import { TextSlice, WordRange } from "dt-sql-parser/dist/parser/common/textAndWord";
import { ProgramContext, HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext } from "antlr4ng";
import tableData from './data/table_descriptions.json'

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

function wordToRange(slice?: WordRange) {
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
}): boolean {
    const startToken = context.start;
    const endToken = context.stop;
    if (!startToken || !endToken) {
        return false;
    }
    const startLine = startToken.line;
    const startColumn = startToken.column;
    const endLine = endToken.line;
    const endColumn = endToken.column;

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
    const start = node.start ? `${node.start.line}:${node.start.column}` : 'null';
    const stop = node.stop ? `${node.stop.line}:${node.stop.column}` : 'null';

    return `Node(${ruleIndexToDisplayName(node.ruleIndex)}, ${start} -> ${stop})`;
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
                console.log('visitChildren', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitChildren(node);
        }

        visitTerminal(node: any) :any {
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

function getTableInfoByName(tableName: string) {
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
                foundNode.ruleIndex !== HiveSqlParser.RULE_id_
                && foundNode.ruleIndex !== HiveSqlParser.RULE_columnNamePath
                && foundNode.ruleIndex !== HiveSqlParser.RULE_poolPath
                && foundNode.ruleIndex !== HiveSqlParser.RULE_constant
            )) {
                return;
            }

            const parent = foundNode.parent!;
            const parentRuleName = ruleIndexToDisplayName(parent.ruleIndex);
            const currentRuleName = ruleIndexToDisplayName(foundNode.ruleIndex);
            const parentParentRuleName = ruleIndexToDisplayName(parent.parent?.ruleIndex || -1);
            console.log (parentParentRuleName, '->', parentRuleName, '-> *', currentRuleName);

            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
            const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);

            console.log('do hover syntaxSuggestions', position, syntaxSuggestions,  currentEntities);

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


            if (parent.ruleIndex === HiveSqlParser.RULE_poolPath
                && (
                    parent.parent?.ruleIndex === HiveSqlParser.RULE_columnName
                    || parent.parent?.ruleIndex === HiveSqlParser.RULE_columnNamePath
                )
            ) {
                const tableIdExp = parent.children?.length === 1 ? undefined : parent.children![0].getText();
                const columnName = parent.children?.length === 1 ? parent.children![0].getText() : parent.children![2].getText();
                const range = {
                    startLineNumber: foundNode.start!.line,
                    startColumn: foundNode.start!.start,
                    endLineNumber: foundNode.stop!.line,
                    endColumn: foundNode.stop!.stop,
                };
                if (!tableIdExp) {
                    const tableInfo = getTableInfoByName(currentEntities[0].text)
                    if (!tableInfo) {
                        return {
                            contents: [
                                {
                                    value: `table not found: ${currentEntities[0].text}`
                                },
                            ],
                            range,
                        };
                    }
                    const columnInfo = getColumnInfoByName(currentEntities[0].text, columnName);
                    if (!columnInfo) {
                        return {
                            contents: [
                                {
                                    value: `column not found: ${columnName} in table ${currentEntities[0].text}`
                                },
                            ],
                            range,
                        };
                    }
                    return {
                        contents: [
                            {
                                value: `**Table:** ${currentEntities[0].text}, **Column:** ${columnName}`
                            },
                        ],
                        range,
                    };
                }
                const tableInfo = getTableInfoByName(tableIdExp);
                return {
                    contents: [
                        {
                            value: `**Table:** ${tableIdExp}, **Column:** ${columnName}`
                        },
                    ],
                    range: {
                        startLineNumber: foundNode.start!.line,
                        startColumn: foundNode.start!.start,
                        endLineNumber: foundNode.stop!.line,
                        endColumn: foundNode.stop!.stop,
                    }
                };
            }

            // columnName -> poolPath -> id_(from default table name)
            // columnName -> poolPath -> id_(table name or alias), ., _id
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