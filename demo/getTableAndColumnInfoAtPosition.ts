import { ParserRuleContext } from "antlr4ng";
import { TableSourceContext, HiveSqlParser, SelectItemContext, FunctionIdentifierContext, ColumnNameContext, ColumnNamePathContext, SubQuerySourceContext, TableNameContext, Id_Context, CteStatementContext, ExpressionContext, TableAllColumnsContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { IdentifierScope } from "./Identifier_scope";
import { MapReduceScope } from "./mr_scope";
import { EntityInfo, tableInfoFromNode, getColumnInfoByName, } from "./formatHoverRes";
import { printNodeTree, printNode, rangeFromNode } from "./sql_ls_helper";
import { matchType, matchSubPathOneOf, matchSubPath } from "./sql_tree_query";
import tableData from "./data/example";

export const getEntityInfoAtPosition = async (
    foundNode?: ParserRuleContext | null,
    mrScope: MapReduceScope | null = null,
    context?: IdentifierScope | null,
    isTest?: boolean
): Promise<EntityInfo | null> => {
    if (!foundNode || !context || (
        !matchType(foundNode, 'id_')
        && !matchType(foundNode, 'DOT')
        && !matchType(foundNode, 'columnNamePath')
        && !matchType(foundNode, 'poolPath')
        && !matchType(foundNode, 'constant')
    )) {
        return null;
    }

    const ext: string[] = [];
    const pushExt = isTest ? (content: string) => {
        ext.push(content);
    } : () => { };
    pushExt(printNodeTree(foundNode));
    const logger = isTest ? console.log : () => { };
    const allIdentifiers = context.getAllIdentifiers() || {};

    const parent = foundNode.parent!;
    logger('do hover entities', printNode(parent), allIdentifiers.keys());

    const commonFields = {
        range: rangeFromNode(foundNode),
        ext,
    };

    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1392
    const tableSource = matchSubPathOneOf(foundNode, [
        ['id_', 'tableSource'],
    ]);
    if (tableSource) {
        return {
            ...await getEntityInfoFromTableSource(foundNode, tableSource as TableSourceContext, context, mrScope),
            ...commonFields,
        };
    }
    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1418
    const tableName = matchSubPathOneOf(foundNode, [
        ['id_', 'tableName'],
        ['DOT', 'tableName']
    ]);
    if (tableName) {
        return {
            ...await getEntityInfoFromTableName(foundNode, tableName as TableNameContext, context, mrScope),
            ...commonFields,
        };
    }

    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1436
    const subQuerySourceContext = matchSubPath(foundNode, ['id_', 'subQuerySource']);
    if (subQuerySourceContext) {
        return {
            ...await getEntityInfoFromSubQuerySource(foundNode, subQuerySourceContext as SubQuerySourceContext, context, mrScope),
            ...commonFields,
        };
    }

    if (parent.ruleIndex === HiveSqlParser.RULE_viewName) {
        return {
            type: 'unknown',
            text: foundNode.getText(),
            ...commonFields,
        };
    }

    // columnName -> poolPath -> id_(from default table name)
    // columnName -> poolPath -> id_(table name or alias), ., _id
    const columnName = matchSubPathOneOf(foundNode, [
        ['id_', 'poolPath', 'columnName'],
        ['id_', 'poolPath', 'columnNamePath'],
        ['DOT', 'poolPath', 'columnNamePath']
    ])
    if (columnName) {
        
        return {
            ...await getEntityInfoFromColumnName(foundNode, columnName as ColumnNameContext | ColumnNamePathContext, context, mrScope),
            ...commonFields,
        };
    }

    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1514
    if (matchSubPath(foundNode, ['id_', 'selectItem'])) {
        const parent = foundNode.parent! as SelectItemContext;
        // 往前查找 (columnName | expression)
        return {
            type: 'unknown',
            text: foundNode.getText(),
            ...commonFields,
        };
    }

    if (matchSubPath(foundNode, ['id_', 'functionIdentifier'])) {
        return {
            ...getEntityInfoFromFunction(parent as FunctionIdentifierContext),
            ...commonFields,
        };
    }

    return {
        type: 'unknown',
        text: foundNode.getText(),
        ...commonFields,
    };
};

export const getAllEntityInfoFromNode = async (
    node: ParserRuleContext,
    context: IdentifierScope,
    mrScope: MapReduceScope | null,
    isTest: boolean
): Promise<EntityInfo | null> => {
    const ext: string[] = [];
    const pushExt = isTest ? (content: string) => {
        ext.push(content);
    } : () => { };
    pushExt(printNodeTree(node));
    const logger = isTest ? console.log : () => { };
    const allIdentifiers = context.getAllIdentifiers() || {};

    logger('do hover entities', printNode(node), allIdentifiers.keys());

    const commonFields = {
        range: rangeFromNode(node),
        ext,
    };

    if (node instanceof TableSourceContext) {
        return {
            ...await getEntityInfoFromTableSource(node.tableOrView(), node, context, mrScope),
            ...commonFields,
        };
    }

    if (node instanceof ColumnNameContext || node instanceof ColumnNamePathContext) {
        return {
            ...await getEntityInfoFromColumnName(node.poolPath()?.id_(0) || node, node, context, mrScope),
            ...commonFields,
        };
    }

    if (node instanceof TableNameContext) {
        return {
            ...await getEntityInfoFromTableName(node, node, context, mrScope),
            ...commonFields,
        };
    }

    if (node instanceof SubQuerySourceContext) {
        return {
            ...await getEntityInfoFromSubQuerySource(node, node, context, mrScope),
            ...commonFields,
        };
    }

    if (node instanceof Id_Context) {
        if (node.parent instanceof CteStatementContext) {
            const tableInfo = await tableInfoFromNode(node.parent, context)
            return {
                type: 'table' as const,
                tableInfo,
                ...commonFields,
            };
        }
        if (node.parent instanceof SelectItemContext) {
            return {
                type: 'column' as const,
                columnInfo: {
                    column_name: node.getText(),
                    data_type_string: '',
                    description: '',
                },
                ...commonFields,
            };
        }
    }

    if (node instanceof ExpressionContext) {
        return {
            type: 'function' as const,
            text: node.getText(),
            ...commonFields,
        };
    }

    if (node instanceof TableAllColumnsContext) {
        return {
            type: 'column' as const,
            columnInfo: {
                column_name: '*',
                data_type_string: '',
                description: '',
            },
            ...commonFields,
        };
    }

    return {
        type: 'unknown' as const,
        text: node.getText(),
        ...commonFields,
    };
}

async function getEntityInfoFromTableSource(
    node: ParserRuleContext,
    parent: TableSourceContext,
    context: IdentifierScope,
    mrScope: MapReduceScope | null
) {
    const tableName = parent.tableOrView().tableName()?.getText();
    if (tableName) {
        const item = mrScope?.getTableByName(tableName);
        const tableInfo = item && await tableInfoFromNode(item, context);
        if (tableInfo) {
            return {
                type: 'table' as const,
                tableInfo,
            };
        }
    }
    return {
        type: 'noTable' as const,
        text: node.getText(),
    };
}

async function getEntityInfoFromTableName(
    node: ParserRuleContext,
    parent: TableNameContext,
    context: IdentifierScope,
    mrScope: MapReduceScope | null
) {
    const tableName = parent.getText();
    const item = mrScope?.getTableByName(tableName);
    const tableInfo = item && await tableInfoFromNode(item, context);

    if (!tableInfo) {
        const tableInfo = await context.getTableInfoByName(tableName, undefined);

        if (tableInfo) {
            return {
                type: 'table' as const,
                tableInfo,
            };
        }

        return {
            type: 'noTable' as const,
            text: tableName,
        };
    }

    return {
        type: 'table' as const,
        tableInfo,
    };
}

async function getEntityInfoFromSubQuerySource(
    node: ParserRuleContext,
    parent: SubQuerySourceContext,
    context: IdentifierScope,
    mrScope?: MapReduceScope | null
) {
    const item = mrScope?.getTableByName(node.getText());
    const tableInfo = item && await tableInfoFromNode(item, context);
    if (!tableInfo) {
        return {
            type: 'unknown' as const,
            text: node.getText(),
        };
    }

    return {
        type: 'table' as const,
        tableInfo,
    };
}


function tableIdAndColumnNameFromPoolPath(poolPath: ParserRuleContext | null): { tableId: string | undefined; columnName: string } {
    if (!poolPath) {
        return { tableId: undefined, columnName: '' };
    }
    const segs = poolPath.children?.map(c => c.getText()) || [];
    const tableId = segs.length === 1 ? undefined : segs[0];
    const columnName = segs.length === 1 ? segs[0] : segs[2];
    return { tableId, columnName };
}

async function getEntityInfoFromColumnName(
    node: ParserRuleContext,
    parent: ColumnNameContext | ColumnNamePathContext,
    context: IdentifierScope,
    mrScope: MapReduceScope | null
) {

    const poolPath = parent.poolPath();
    // 只支持 table_name.column_name or column_name for now
    const { tableId: tableIdExp, columnName } = tableIdAndColumnNameFromPoolPath(poolPath);

    // column_name only
    if (!tableIdExp) {
        const item = mrScope?.getTableByName(mrScope?.getDefaultInputTableName());
        const tableInfo = item && await tableInfoFromNode(item, context);
        if (!tableInfo) {
            return {
                type: 'noTable' as const,
                text: printNode(parent),
            };
        }
        const columnInfo = getColumnInfoByName(tableInfo, columnName!);
        if (!columnInfo) {
            return {
                type: 'noColumn' as const,
                tableInfo,
                text: columnName,
            };
        }
        return {
            type: 'column' as const,
            tableInfo,
            columnInfo,
        };
    }

    const item = mrScope?.getTableByName(tableIdExp);
    const tableInfo = item && await tableInfoFromNode(item, context);
    console.log('tableIdExp', tableIdExp, 'context', context, 'mrScope', mrScope, 'mrScope?.getTableByName()', mrScope?.getTableByName(tableIdExp), 'item', item);

    if (!tableInfo) {
        console.log('No table info found for:', printNode(item));
        return {
            type: 'noTable' as const,
            text: tableIdExp,
        };
    }
    const columnInfo = getColumnInfoByName(tableInfo, columnName);
    if (!columnInfo) {
        return {
            type: 'noColumn' as const,
            tableInfo,
            text: columnName,
        };
    }
    return {
        type: 'column' as const,
        tableInfo,
        columnInfo,
    };
}

function getEntityInfoFromFunction(node: FunctionIdentifierContext) {
    return {
        type: 'function' as const,
        text: node.getText(),
    };
}