import { ParserRuleContext } from "antlr4ng";
import {
    ColumnNameContext,
    ColumnNameCreateContext,
    ColumnNamePathContext,
    CteStatementContext,
    ExpressionContext,
    Id_Context,
    SubQuerySourceContext,
    TableNameContext,
    TableNameCreateContext,
    TableSourceContext,
    VirtualTableSourceContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";


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

export type tableReferenceContext = TableSourceContext | CteStatementContext | VirtualTableSourceContext | SubQuerySourceContext;

export interface TableSource {
    tableName: string;
    reference: tableReferenceContext;
    defineReference: ParserRuleContext;
}

export interface ColumnInfo {
    exportColumnName: string;
    referenceTableName: string;
    referenceColumnName: string;
    reference: ParserRuleContext;
    defineReference: ParserRuleContext;
}

export type tableDefType = 'local' | 'external';

export interface MrScopeNodeData {
    id: string;
    deps: string[];
    type: tableDefType;
    label: string;
    description?: string;
    onNodeSizeChange?: (nodeId: string, size: { width: number; height: number }) => void;
}

export type HighlightContext = ColumnNameContext |
    ColumnNamePathContext |
    ColumnNameCreateContext |
    TableNameContext |
    TableNameCreateContext |
    ExpressionContext |
    Id_Context; // for tableReferenceContext's id
