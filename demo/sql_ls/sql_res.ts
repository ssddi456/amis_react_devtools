import { ParseTree } from "antlr4ng";
import type { IRange } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { TableInfo, ExtColumnInfo } from "./types";

export const noTableInfoRes = (text: string, range: IRange, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [`table not found: ${text}`, ...(ext || [])].filter(Boolean).join('\n')
            },
        ],
        range,
    };
    console.log('noTableInfoRes result:', result);
    return result;
};
export const noColumnInfoRes = (table: TableInfo, columnName: string, range: IRange, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `column: ${columnName} not found in table ${table.table_name}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n')
            },
        ],
        range,
    };
    console.log('noColumnInfoRes result:', result);
    return result;
};
export const tableAndColumn = (table: TableInfo, column: ExtColumnInfo, range: IRange, ext?: string[]) => {
    const result = {
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
    };
    console.log('tableAndColumn result:', result);
    return result;
};
export const tableRes = (table: TableInfo, range: IRange, ext?: string[]) => {
    const result = {
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
    };
    console.log('tableRes result:', result);
    return result;
};
export const functionRes = (text: string, range: IRange, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `**Function:** ${text}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n\n')
            },
        ],
        range,
    };
    console.log('functionRes result:', result);
    return result;
};
export const unknownRes = (text: string, range: IRange, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `unknown: ${text}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n')
            },
        ],
        range,
    };
    console.log('unknownRes result:', result);
    return result;
};
export const createColumnRes = (node: ParseTree, range: IRange, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `**create Column:** ${node.getText()}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n\n')
            },
        ],
        range,
    };
    console.log('createColumnRes result:', result);
    return result;
};
