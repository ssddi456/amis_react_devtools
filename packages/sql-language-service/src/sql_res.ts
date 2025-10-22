import { TableInfo, ExtColumnInfo } from "./types";
import { Range } from './helpers/pos';

export const noTableInfoRes = (text: string, range: Range, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [`table not found: ${text}`, ...(ext || [])].filter(Boolean).join('\n')
            },
        ],
        range,
    };
    return result;
};
export const noColumnInfoRes = (table: TableInfo, columnName: string, range: Range, ext?: string[]) => {
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
    return result;
};
export const tableAndColumn = (table: TableInfo, column: ExtColumnInfo, range: Range, ext?: string[]) => {
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
    return result;
};
export const tableRes = (table: TableInfo, range: Range, ext?: string[]) => {
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
    return result;
};
export const functionRes = (text: string, range: Range, ext?: string[]) => {
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
    return result;
};
export const insertRes = (text: string, range: Range, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `**insert table:** ${text}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n\n')
            },
        ],
        range,
    };
    return result;
};
export const aliasRes = (text: string, range: Range, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `**alias:** ${text}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n\n')
            },
        ],
        range,
    };
    return result;
};
export const unknownRes = (text: string, range: Range, ext?: string[]) => {
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
    return result;
};
export const createColumnRes = (node: string, range: Range, ext?: string[]) => {
    const result = {
        contents: [
            {
                value: [
                    `**create Column:** ${node}`,
                    ...(ext || [])
                ].filter(Boolean).join('\n\n')
            },
        ],
        range,
    };
    return result;
};
