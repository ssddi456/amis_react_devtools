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
            const ctx = getCtxFromPos(position);
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            if (!ctx || !syntaxSuggestions) {
                return;
            }

            const table = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.TABLE);
            if (table) {
                // 这里搞一下找表名
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
        },
        doValidation() {
            const errors =hiveSqlParse.validate(document.getText());
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