import { ParserRuleContext, ParseTree } from "antlr4ng";
import { TableSourceContext, SubQuerySourceContext, VirtualTableSourceContext, CteStatementContext, TableNameContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { type IRange, languages, Uri } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { IdentifierScope } from "./identifier_scope";
import { MapReduceScope } from "./mr_scope";
import { tableRes, tableAndColumn, noTableInfoRes, noColumnInfoRes, createColumnRes, functionRes, unknownRes } from "./sql_res";
import { rangeFromNode, } from "./helpers/table_and_column";
import { ExtColumnInfo, TableInfo } from "./types";
import { printNode } from "./helpers/log";
import { matchSubPathOneOf, matchSubPath } from "./helpers/tree_query";
import { WithSource } from "./util";
import { localDbId } from "./consts";

async function tableInfoFromTableSource(
    tableSource: TableSourceContext | null,
    context: IdentifierScope,
    collection?: TableInfo[]
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
    const tableInfo = await context.getTableInfoByName(tableName, undefined);
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
        if (collection) {
            collection.push(ret);
        }
        return ret;
    }
    return null;
}

function tableInfoFromSubQuerySource(
    subQuerySource: SubQuerySourceContext,
    context: IdentifierScope,
    collection?: TableInfo[]
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
    if (collection) {
        collection.push(ret);
    }
    return ret;

}

function tableInfoFromVirtualTableSource(
    virtualTableSource: VirtualTableSourceContext | null,
    context: IdentifierScope,
    collection?: TableInfo[]
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
    if (collection) {
        collection.push(ret);
    }
    return ret;
}

function tableInfoFromCteStatement(
    cteStatement: CteStatementContext | null,
    context: IdentifierScope,
    collection?: TableInfo[]
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
    if (collection) {
        collection.push(ret);
    }
    return ret;
}

export async function tableInfoFromNode(
    node: ParserRuleContext | null,
    context: IdentifierScope
): Promise<TableInfo | null> {
    if (!node) {
        return null;
    }

    const collection: TableInfo[] = [];
    if (node instanceof TableSourceContext) {
        return await tableInfoFromTableSource(node, context, collection);
    } else if (node instanceof SubQuerySourceContext) {
        return tableInfoFromSubQuerySource(node, context, collection);
    } else if (node instanceof VirtualTableSourceContext) {
        return tableInfoFromVirtualTableSource(node, context, collection);
    } else if (node instanceof CteStatementContext) {
        return tableInfoFromCteStatement(node, context, collection);
    } else {
    }
    return collection[0];
}

enum EntityInfoType {
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
    columnInfo?: ExtColumnInfo | null;
    text?: string;
    range: IRange;
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
            return { ...createColumnRes({ getText: () => hoverInfo.text! } as ParseTree, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.Function:
            return { ...functionRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case EntityInfoType.Unknown:
        default:
            return { ...unknownRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
    }
};

export const formatDefinitionRes = (uri: Uri, hoverInfo: EntityInfo): WithSource<languages.Definition> | undefined => {
    if ((hoverInfo.type === 'table' || hoverInfo.type === 'column')
        && hoverInfo.tableInfo && hoverInfo.tableInfo.range) {
        return {
            uri,
            range: hoverInfo.tableInfo.range,
            __source: hoverInfo.__source
        };
    }
    return;
};

export const getIdentifierReferences = (
    foundNode: ParserRuleContext,
    mrScope: MapReduceScope | null | undefined,
    context: IdentifierScope
): ParserRuleContext[] | undefined => {
    const foundTableSource = matchSubPathOneOf(foundNode, [
        ['id_', 'tableSource'],
        ['DOT', 'tableSource'],
    ]) as TableSourceContext | null;
    if (foundTableSource) {
        if (foundTableSource.id_()) {
            const alias = foundTableSource.id_()?.getText();
            if (!alias) {
                return;
            }
            return context.getReferencesByName(alias);
        }
        return;
    }

    const foundTableName = matchSubPathOneOf(foundNode, [
        ['id_', 'tableName'],
    ]) as TableNameContext | null;
    if (foundTableName) {
        const tableName = foundTableName.getText();
        return context.getReferencesByName(tableName);
    }


    const foundSubQuerySource = matchSubPath(foundNode, ['id_', 'subQuerySource']) as SubQuerySourceContext | null;
    if (foundSubQuerySource) {
        const alias = foundSubQuerySource.id_()?.getText();
        if (!alias) {
            return;
        }
        return context.getReferencesByName(alias);
    }

    const foundVirtualTableSource = matchSubPath(foundNode, ['id_', 'virtualTableSource']) as VirtualTableSourceContext | null;
    if (foundVirtualTableSource) {
        const alias = foundVirtualTableSource.tableAlias()?.getText();
        if (!alias) {
            return;
        }
        return context.getReferencesByName(alias);
    }

    return;
};
