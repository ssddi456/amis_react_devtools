import { ParserRuleContext } from "antlr4ng";


export interface ITableSourceManager {
    getTableInfoByName(tableName: string, dbName: string | undefined): Promise<TableInfo | null>;
}

export interface TableInfo {
    db_name: string;
    table_name: string;
    alias?: string;
    table_id: number;
    description: string;
    column_list: ExtColumnInfo[];
    range?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

export interface ExtColumnInfo {
    column_name: string;
    data_type_string: string;
    description: string;
}

export interface TableSource {
    tableName: string;
    reference: ParserRuleContext;
    defineReference: ParserRuleContext;
}

export interface ColumnInfo {
    exportColumnName: string;
    referanceTableName: string;
    referanceColumnName: string;
    reference: ParserRuleContext;
    defineReference: ParserRuleContext;
}
