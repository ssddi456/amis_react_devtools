import { ParserRuleContext, ParseTree } from "antlr4ng";
import { EntityContext } from "dt-sql-parser";
import { TableSourceContext, SubQuerySourceContext, VirtualTableSourceContext, CteStatementContext, TableNameContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { AttrName } from "dt-sql-parser/dist/parser/common/entityCollector";
import { type IRange, languages, Uri } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import tableData from "./data/example";
import { IdentifierScope } from "./Identifier_scope";
import { WithSource } from "./ls_helper";
import { MapReduceScope } from "./mr_scope";
import { tableRes, tableAndColumn, noTableInfoRes, noColumnInfoRes, createColumnRes, functionRes, unknownRes } from "./sql_hover_res";
import { printNode, rangeFromNode, wordToRange } from "./sql_ls_helper";
import { matchSubPathOneOf, matchSubPath } from "./sql_tree_query";

function tableInfoFromTableSource(
    tableSource: TableSourceContext | null,
    context: IdentifierScope,
    collection?: TableInfo[]
): TableInfo | null {
    if (!tableSource) {
        return null;
    }
    const alias = tableSource?.id_()?.getText();
    const tableName = tableSource?.tableOrView().tableName()?.getText();
    console.log('collectTableInfo visitJoinSourcePart', printNode(tableSource), 'alias:', alias, 'tableName:', tableName);
    if (!tableName) {
        console.warn('No table name found in join source part:', printNode(tableSource));
        return null;
    }
    const tableInfo = getTableInfoByName(tableName, undefined, [], null);
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
const localDbId = 'local db';
export function tableInfoFromSubQuerySource(
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
    console.log('collectTableInfo visitJoinSourcePart', printNode(subQuerySource), 'alias:', alias, 'tableName:', tableQuery);
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
    console.log('collectTableInfo visitVirtualTableSource', printNode(virtualTableSource), 'alias:', alias);

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
    console.log('collectTableInfo visitCteStatement', printNode(cteStatement), 'alias:', alias);
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

export function tableInfoFromNode(
    node: ParserRuleContext | null,
    context: IdentifierScope
): TableInfo | null {
    if (!node) {
        return null;
    }
    console.log('tableInfoFromNode find by node', printNode(node));

    const collection: TableInfo[] = [];
    if (node instanceof TableSourceContext) {
        return tableInfoFromTableSource(node, context, collection);
    } else if (node instanceof SubQuerySourceContext) {
        return tableInfoFromSubQuerySource(node, context, collection);
    } else if (node instanceof VirtualTableSourceContext) {
        return tableInfoFromVirtualTableSource(node, context, collection);
    } else if (node instanceof CteStatementContext) {
        return tableInfoFromCteStatement(node, context, collection);
    } else {
        console.log('tableInfoFromNode unknown node type', printNode(node));
    }
    return collection[0];
}


export interface TableInfo {
    db_name: string;
    table_name: string;
    alias?: string;
    table_id: number;
    description: string;
    column_list: ColumnInfo[];
    range?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

export interface ColumnInfo {
    column_name: string;
    data_type_string: string;
    description: string;
}
export function getTableInfoByName(
    tableName: string,
    dbName: string | undefined,
    entities: EntityContext[],
    extInfos: TableInfo[] | null
): TableInfo | null {
    if (!tableName) {
        return null;
    }
    if (!dbName && tableName.indexOf('.') !== -1) {
        const parts = tableName.split('.');
        dbName = parts[0];
        tableName = parts[1];
        if (!dbName || !tableName) {
            return null;
        }
    }
    if (dbName) {
        return tableData.find(t => t.table_name === tableName && t.db_name === dbName) || null;
    }
    const tableInfo = tableData.find(t => t.table_name === tableName);
    if (tableInfo) {
        return tableInfo;
    }

    if (extInfos && extInfos.length > 0) {
        const extTableInfo = extInfos.find(t => t.table_name === tableName || t.alias === tableName);
        if (extTableInfo) {
            return extTableInfo;
        }
    }

    // if is a entity alias
    if (!entities || entities.length === 0) {
        return null;
    }

    const tableEntity = entities.find(e => e.text === tableName || e[AttrName.alias]?.text === tableName);
    if (!tableEntity) {
        return null;
    }
    if (tableEntity.text.indexOf('.') !== -1) {
        const parts = tableEntity.text.split('.');
        dbName = parts[0];
        tableName = parts[1];
        if (!dbName || !tableName) {
            return null;
        }
        const ret = tableData.find(t => t.table_name === parts[1] && t.db_name === parts[0]) || null;
        if (ret) {
            return {
                db_name: ret.db_name,
                table_name: ret.table_name,
                alias: tableEntity[AttrName.alias]?.text || '',
                table_id: ret.table_id,
                description: ret.description,
                column_list: ret.column_list,
                range: wordToRange(tableEntity.position)
            };
        }
    }
    return {
        db_name: localDbId,
        table_name: tableEntity.text,
        table_id: 0, // 这里没用
        description: '',
        column_list: [],
        range: wordToRange(tableEntity.position)
    };
}

export function getColumnInfoByName(tableInfo: TableInfo | null, columnName: string): ColumnInfo | null {
    if (!tableInfo || !columnName) {
        return null;
    }
    if (tableInfo.db_name == localDbId) {
        return {
            column_name: columnName,
            data_type_string: 'unknown',
            description: 'unknown column'
        };
    }
    const columnInfo = tableInfo.column_list.find(c => c.column_name === columnName);
    return columnInfo || null;
}

export interface EntityInfo {
    type: 'table' | 'column' | 'unknown' | 'noTable' | 'noColumn' | 'createColumn' | 'function';
    tableInfo?: TableInfo | null;
    columnInfo?: ColumnInfo | null;
    text?: string;
    range: IRange;
    ext?: string[];
    __source?: {
        fileName: string;
        lineNumber: number;
        columnNumber: number;
    };
}
export const formatHoverRes = (hoverInfo: EntityInfo): WithSource<languages.Hover> => {
    console.log('formatHoverRes', hoverInfo);
    switch (hoverInfo.type) {
        case 'table':
            return { ...tableRes(hoverInfo.tableInfo!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'column':
            return { ...tableAndColumn(hoverInfo.tableInfo!, hoverInfo.columnInfo!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'noTable':
            return { ...noTableInfoRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'noColumn':
            return { ...noColumnInfoRes(hoverInfo.tableInfo!, hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'createColumn':
            return { ...createColumnRes({ getText: () => hoverInfo.text! } as ParseTree, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'function':
            return { ...functionRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
        case 'unknown':
        default:
            return { ...unknownRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext), __source: hoverInfo.__source };
    }
};
export const formatDefinitionRes = (uri: Uri, hoverInfo: EntityInfo): WithSource<languages.Definition> | undefined => {
    console.log('formatDefinitionRes', uri, hoverInfo);
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
