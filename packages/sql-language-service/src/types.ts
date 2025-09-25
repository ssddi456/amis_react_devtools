import { ParserRuleContext, TerminalNode } from "antlr4ng";
import {
    AtomSelectStatementContext,
    ColumnNameContext,
    ColumnNameCreateContext,
    ColumnNamePathContext,
    CteStatementContext,
    ExpressionContext,
    Id_Context,
    QueryStatementExpressionContext,
    SelectStatementContext,
    SubQuerySourceContext,
    TableNameContext,
    TableNameCreateContext,
    TableSourceContext,
    VirtualTableSourceContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ErrorType } from "./consts";
import { Pos, Range } from "./helpers/pos";
import { editor } from "monaco-editor";
import { ContextManager } from "./context_manager";
import { MapReduceScope } from "./mr_scope";
import { IdentifierScope } from "./identifier_scope";


export interface ITableSourceManager {
    getTableInfoByName(tableName: string, dbName: string | undefined): Promise<TableInfo | null> | TableInfo | null;
}

export interface TableInfo {
    db_name: string;
    table_name: string;
    alias?: string;
    table_id: number;
    description: string;
    column_list: (ExtColumnInfo & {range?: Range})[];
    range?: Range;
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
export type MrScopeId = string; // usually it's the start position like '12:34'
export interface MrScopeNodeData {
    id: MrScopeId;
    pos: Pos;
    deps: string[];
    isOrphan: boolean;
    type: tableDefType;
    label: string;
    description?: string;
    onNodeSizeChange?: (nodeId: string, size: { width: number; height: number }) => void;
}

export type MrScopeContext = QueryStatementExpressionContext | AtomSelectStatementContext | SelectStatementContext;

export type HighlightContext = ColumnNameContext |
    ColumnNamePathContext |
    ColumnNameCreateContext |
    TableNameContext |
    TableNameCreateContext |
    ExpressionContext |
    Id_Context; // for tableReferenceContext's id

export interface ValidateError {
    message: string;
    context: ParserRuleContext | TerminalNode;
    level: 'error' | 'warning';
    type: ErrorType
}

export interface customActionRunHandler {
    (option: {
        editor: editor.IStandaloneCodeEditor,
        position?: Pos,
        foundNode?: ParserRuleContext,
        contextManager: ContextManager,
        context?: IdentifierScope,
        mrScope?: MapReduceScope,
    }): Promise<void> | void;
}