import { ParseTree } from "antlr4ng";
import type { IRange } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { TableInfo, ColumnInfo } from "./sql_ls";

export const noTableInfoRes = (text: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [`table not found: ${text}`, ...(ext || [])].filter(Boolean).join('\n')
        },
    ],
    range,
});
export const noColumnInfoRes = (table: TableInfo, columnName: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `column: ${columnName} not found in table ${table.table_name}`,
                ...(ext || [])
            ].filter(Boolean).join('\n')
        },
    ],
    range,
});
export const tableAndColumn = (table: TableInfo, column: ColumnInfo, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description,
                `**Column:** ${column.column_name} [${column.data_type_string}]`,
                column.description,
                ...(ext || [])
            ].filter(Boolean).join('\n\n'),
        },
    ],
    range,
});
export const tableRes = (table: TableInfo, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description,
                ...(ext || [])
            ].filter(Boolean).join('\n\n')
        },
    ],
    range,
});
export const unknownRes = (text: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `unknown: ${text}`,
                ...(ext || [])
            ].filter(Boolean).join('\n')
        },
    ],
    range,
});
export const createColumnRes = (node: ParseTree, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**create Column:** ${node.getText()}`,
                ...(ext || [])
            ].filter(Boolean).join('\n\n')
        },
    ],
    range,
});
