import { editor, languages, type IMarkdownString, Position } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContextType, HiveSQL, HiveSqlParserVisitor } from 'dt-sql-parser';
import { toRange, posToPosition, posInRange } from "./ls_helper";
import { TextSlice, WordRange } from "dt-sql-parser/dist/parser/common/textAndWord";
import { ProgramContext, HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { RuleStmtContext } from "dt-sql-parser/dist/lib/postgresql/PostgreSqlParser";
import { RuleContext } from "antlr4ng";


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
        start: number;
        stop: number;
    } | null;
    stop: {
        line: number;
        start: number;
        stop: number;
    } | null;
}): boolean {
    const startToken = context.start;
    const endToken = context.stop;
    if (!startToken || !endToken) {
        return false;
    }
    const startLine = startToken.line;
    const startColumn = startToken.start;
    const endLine = endToken.line;
    const endColumn = endToken.stop;

    if (position.lineNumber === startLine && position.column >= startColumn) {
        return true;
    }
    if (position.lineNumber === endLine && position.column <= endColumn) {
        return true;
    }
    if (position.lineNumber > startLine && position.lineNumber < endLine) {
        return true;
    }
    return false;
}

function findTokenAtPosition(
    position: Position,
    tree: ProgramContext
): RuleContext | null {
    let foundNode = null;
    const visitor = new class extends HiveSqlParserVisitor<any> {
        visit(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('Found node at position:', position, 'Node:', node);
            }
            return super.visit(tree);
        }
        
        visitChildren(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('Found node at position:', position, 'Node:', node);
            }
            return super.visitChildren(node);
        }
    };
    visitor.visit(tree);
    if (!foundNode) {
        console.warn('No node found at position:', position, 'tree:', tree);
    } else {
        console.log('Found node at position:', position, 'Node:', foundNode);
    }
    return foundNode;
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

export const getHiveType = (model: editor.ITextModel) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(document.getText());

    const getCtxFromPos = (position: Position) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                const text = penddingSliceText(slice, document.getText());
                console.log('getCtxFromPos text', '-->' + text + '<--');
                const ctx = hiveSqlParse.createParser(text);
                const tree = ctx.program();
                const foundNode = findTokenAtPosition(position, tree);
                return foundNode;
            }
        }
    };

    return {
        doComplete: (position: Position) => {
            getCtxFromPos(position);
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            const word = model.getWordAtPosition(position);

            console.log('do completes syntaxSuggestions', syntaxSuggestions, word);
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
            if (!foundNode || foundNode.ruleIndex !== HiveSqlParser.RULE_id_) {
                return;
            }

            const parent = foundNode.parent!;
            console.log('parent type', ruleIndexToDisplayName(parent.ruleIndex));

            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            const word = model.getWordAtPosition(position);
            const nextChar = model.getLineContent(position.lineNumber).charAt(position.column);
            const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];

            console.log('do hover syntaxSuggestions', position, syntaxSuggestions, word, nextChar, entities);

            if (syntaxSuggestions) {
                const table = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.TABLE);
                if (table) {
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