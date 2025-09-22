import { ParserRuleContext } from "antlr4ng";
import { TableSourceContext, SubQuerySourceContext, VirtualTableSourceContext, CteStatementContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { languages, Uri } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { IdentifierScope } from "./identifier_scope";
import { tableRes, tableAndColumn, noTableInfoRes, noColumnInfoRes, createColumnRes, functionRes, unknownRes } from "./sql_res";
import { rangeFromNode, Range } from "./helpers/pos";
import { ExtColumnInfo, TableInfo } from "./types";
import { printNode } from "./helpers/log";
import { WithSource } from "./helpers/util";
import { localDbId } from "./consts";

async function tableInfoFromTableSource(
    tableSource: TableSourceContext | null,
    context: IdentifierScope,
): Promise<TableInfo | null> {
    if (!tableSource) {
        return null;
    }
    const alias = tableSource?.id_()?.getText();
    const tableName = tableSource?.tableOrView().tableName()?.getText();
    if (!tableName) {
        console.warn('No table name found in join source part:', printNode(tableSource));
        return null;
    }

    const tableId = context.lookupDefinition(tableName);
    // console.log('tableInfoFromTableSource tableId', tableId, tableName, tableSource);
    if (tableId === null) {
        const tableInfo = await context.getForeignTableInfoByName(tableName, undefined);
        if (tableInfo) {
            const ret = {
                db_name: tableInfo.db_name,
                table_name: tableInfo.table_name,
                alias: alias,
                table_id: tableInfo.table_id,
                description: tableInfo.description,
                column_list: tableInfo.column_list,
                range: rangeFromNode(tableSource),
            };
            return ret;
        }
        return null;
    }

    return tableInfoFromNode(tableId, context);
}

function tableInfoFromSubQuerySource(
    subQuerySource: SubQuerySourceContext,
    context: IdentifierScope,
): TableInfo | null {
    if (!subQuerySource) {
        return null;
    }
    const alias = subQuerySource.id_()?.getText();
    const mrScope = context.getMrScope();

    const tableQuery = subQuerySource.queryStatementExpression().getText();
    if (!tableQuery) {
        console.warn('No table name found in sub query source:', printNode(subQuerySource));
        return null;
    }
    const ret: TableInfo = {
        db_name: localDbId,
        table_name: '[subquery]',
        alias: alias,
        table_id: -1,
        description: '',
        column_list: mrScope?.exportColumns.map(col => ({
            column_name: col.exportColumnName,
            data_type_string: 'string', // unknown
            description: '', // should be refer
        })) || [],
        range: rangeFromNode(subQuerySource)
    };
    return ret;
}

function tableInfoFromVirtualTableSource(
    virtualTableSource: VirtualTableSourceContext | null,
    context: IdentifierScope,
): TableInfo | null {
    if (!virtualTableSource) {
        return null;
    }
    const alias = virtualTableSource.tableAlias()?.getText();
    const ret = {
        db_name: localDbId,
        table_name: alias,
        alias: alias,
        table_id: -1,
        description: '',
        column_list: [],
        range: rangeFromNode(virtualTableSource)
    };
    return ret;
}

function tableInfoFromCteStatement(
    cteStatement: CteStatementContext | null,
    context: IdentifierScope,
): TableInfo | null {
    if (!cteStatement) {
        return null;
    }
    const alias = cteStatement.id_()?.getText();
    const mrScope = context.getMrScope();
    const ret = {
        db_name: localDbId,
        table_name: alias,
        alias: alias,
        table_id: -1,
        description: '',
        column_list: mrScope?.exportColumns.map(col => ({
            column_name: col.exportColumnName,
            data_type_string: 'string', // unknown
            description: '', // should be refer
        })) || [],
        range: rangeFromNode(cteStatement)
    };
    return ret;
}

export async function tableInfoFromNode(
    node: ParserRuleContext | null,
    context: IdentifierScope
): Promise<TableInfo | null> {
    if (!node) {
        return null;
    }

    if (node instanceof TableSourceContext) {
        return await tableInfoFromTableSource(node, context);
    } else if (node instanceof SubQuerySourceContext) {
        return tableInfoFromSubQuerySource(node, context);
    } else if (node instanceof VirtualTableSourceContext) {
        return tableInfoFromVirtualTableSource(node, context);
    } else if (node instanceof CteStatementContext) {
        return tableInfoFromCteStatement(node, context);
    }

    return null;
}

export enum EntityInfoType {
    Table = 'table',
    Column = 'column',
    Unknown = 'unknown',
    NoTable = 'noTable',
    NoColumn = 'noColumn',
    CreateColumn = 'createColumn',
    Function = 'function',
}

export interface EntityInfo {
    type: EntityInfoType;
    tableInfo?: TableInfo | null;
    columnInfo?: ExtColumnInfo & { range?: Range} | null;
    text?: string;
    range: Range;
    ext?: string[];
    __source?: {
        fileName: string;
        lineNumber: number;
        columnNumber: number;
    };
}

const ErrorTypes = new Set([EntityInfoType.Unknown, EntityInfoType.NoTable, EntityInfoType.NoColumn]);

export function formatHoverRes(hoverInfo: EntityInfo, ignoreError = false): WithSource<languages.Hover> | null {
    if (ignoreError && ErrorTypes.has(hoverInfo.type)) {
        return null;
    }
    switch (hoverInfo.type) {
        case EntityInfoType.Table:
            return { ...tableRes(hoverInfo.tableInfo!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.Column:
            return { ...tableAndColumn(hoverInfo.tableInfo!, hoverInfo.columnInfo!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.NoTable:
            return { ...noTableInfoRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.NoColumn:
            return { ...noColumnInfoRes(hoverInfo.tableInfo!, hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.CreateColumn:
            return { ...createColumnRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.Function:
            return { ...functionRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.Unknown:
        default:
            return { ...unknownRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
    }
};

export const formatDefinitionRes = (uri: Uri, hoverInfo: EntityInfo): WithSource<languages.Definition> | undefined => {
    if (hoverInfo.type === EntityInfoType.Table) {
        if (hoverInfo.tableInfo?.range) {
            return {
                uri,
                range: hoverInfo.tableInfo.range,
                __source: hoverInfo.__source
            };
        } else {
            // how?
        }
        return;
    }
    if (hoverInfo.type === EntityInfoType.Column) {
        if (hoverInfo.columnInfo?.range) {
            return {
                uri,
                range: hoverInfo.columnInfo.range,
                __source: hoverInfo.__source
            };
        } else if (hoverInfo.tableInfo?.range) {
            return {
                uri,
                range: hoverInfo.tableInfo.range,
                __source: hoverInfo.__source
            };
        } else {
            // how?
        }
        return;
    }

};


