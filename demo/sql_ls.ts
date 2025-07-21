import { editor, languages, type IMarkdownString } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContextType, HiveSQL } from 'dt-sql-parser';
import { toRange, posToPosition, posInRange } from "./ls_helper";
import { TextPosition, TextSlice, WordRange } from "dt-sql-parser/dist/parser/common/textAndWord";


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

function wordToRange(slice: WordRange) {
    return {
        startLineNumber: slice.line,
        startColumn: slice.startColumn,
        endLineNumber: slice.line,
        endColumn: slice.endColumn
    };
}

function penddingSliceText(slice: TextSlice, full: string): string {
    const text = slice.text;
    if (slice.startIndex > 1) {
        const before = full.slice(0, slice.startIndex).replace(/[^\n]/g, ' ');
        return before + text;
    }
    return text
}

// 这里列一下表

export const getHiveType = (model: editor.ITextModel) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(document.getText());

    const getCtxFromPos = (position: { lineNumber: number; column: number; }) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                const text = penddingSliceText(slice, document.getText());
                const ctx = hiveSqlParse.parse(text);
                return ctx;
            }
        }
    };
    return {
        doComplete: (position: {
            lineNumber: number;
            column: number;
        }) => {
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
                    let range = column.wordRanges[0] ? wordToRange(column.wordRanges[0]) : cursorRange;
                    // check if is table_name.column_name
                    if (column.wordRanges[1]?.text === '.') {
                        if (column.wordRanges[2]) {
                            range = wordToRange(column.wordRanges[2]);
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
        doHover: (position: {
            lineNumber: number;
            column: number;
        }) => {
            const ctx = getCtxFromPos(position);
            if (!ctx) {
                return;
            }
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            console.log('do hover syntaxSuggestions', syntaxSuggestions);

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
                const column = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.COLUMN);
                if (column) {
                    const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
                    const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);
                    console.log("currentEntities", currentEntities);
                    if (currentEntities.length > 0
                        && currentEntities[0].entityContextType === EntityContextType.TABLE
                    ) {
                        let range = wordToRange(column.wordRanges[0]);
                        // check if is table_name.column_name
                        if (column.wordRanges[1]?.text === '.') {
                            if (column.wordRanges[2]) {
                                range = wordToRange(column.wordRanges[2]);
                            } else {
                                range = {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column + 1,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column + 1
                                };
                            }
                        }
                        return {
                            contents: [
                                {
                                    value: [
                                        `**Table:** ${currentEntities[0].text}`,
                                        `**Column:** ${column.wordRanges[0].text}`
                                    ].join('\n\n'),
                                },
                            ],
                            range
                        };
                    }

                    return {
                        contents: [
                            {
                                value: `**Column:** ${column.wordRanges[0].text}`
                            },
                        ],
                        range: wordToRange(column.wordRanges[0])
                    };
                }
            }
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