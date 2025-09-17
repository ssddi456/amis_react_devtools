import { ParserRuleContext } from "antlr4ng";
import { TableSourceContext, HiveSqlParser, SelectItemContext, FunctionIdentifierContext, ColumnNameContext, ColumnNamePathContext, SubQuerySourceContext, TableNameContext, Id_Context, CteStatementContext, ExpressionContext, TableAllColumnsContext, VirtualTableSourceContext, PoolPathContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { IdentifierScope } from "../identifier_scope";
import { MapReduceScope } from "../mr_scope";
import { EntityInfo, EntityInfoType, tableInfoFromNode, } from "../formatHoverRes";
import { tableIdAndColumnNameFromPoolPath, tableInfoFromSubQuerySource } from "./table_and_column";
import { rangeFromNode } from "./pos";
import { ExtColumnInfo, TableInfo } from "../types";
import { printNodeTree, printNode, logSource } from "./log";
import { matchType, matchSubPathOneOf, matchSubPath } from "./tree_query";
import { ErrorType } from "../consts";
import { localDbId } from "../consts";

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
    const logger = isTest ? console.log : () => { };
    const allIdentifiers = context.getAllIdentifiers() || {};

    const parent = foundNode.parent!;
    // logger('do hover entities', printNode(parent), allIdentifiers.keys());

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

    const cteStatement = matchSubPath(foundNode, ['id_', 'cteStatement']);
    if (cteStatement) {
        return {
            ...await getEntityInfoFromCteStatement(foundNode, cteStatement as CteStatementContext, context, mrScope),
            ...commonFields,
        }
    }

    if (parent.ruleIndex === HiveSqlParser.RULE_viewName) {
        return {
            type: EntityInfoType.Unknown,
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
            type: EntityInfoType.Unknown,
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

    logSource({ type: 'debug', foundNode });

    return {
        type: EntityInfoType.Unknown,
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

    // logger('do hover entities', printNode(node), allIdentifiers.keys());

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
        if (node.parent instanceof CteStatementContext
            || node.parent instanceof TableSourceContext
            || node.parent instanceof SubQuerySourceContext
            || node.parent instanceof VirtualTableSourceContext
        ) {
            const tableInfo = await tableInfoFromNode(node.parent, context)
            return {
                type: EntityInfoType.Table,
                tableInfo,
                ...commonFields,
            };
        }
        if (node.parent instanceof SelectItemContext) {
            return {
                type: EntityInfoType.Column,
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
            type: EntityInfoType.Function,
            text: node.getText(),
            ...commonFields,
        };
    }

    if (node instanceof TableAllColumnsContext) {
        return {
            type: EntityInfoType.Column,
            columnInfo: {
                column_name: '*',
                data_type_string: '',
                description: '',
            },
            ...commonFields,
        };
    }

    return {
        type: EntityInfoType.Unknown,
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
    console.group('getEntityInfoFromTableSource');
    console.log('node', printNode(node));
    console.log('parent', printNode(parent));
    console.log('mrScope', mrScope);
    console.groupEnd();

    let tableName = '';
    if (node === parent.id_()) {
        tableName = parent.id_()!.getText();
    } else if (node === parent.tableOrView()) {
        tableName = parent.tableOrView().tableName()?.getText() || '';
    }

    if (tableName) {
        const item = mrScope?.getTableByName(tableName);
        const tableInfo = item && await tableInfoFromNode(item, context);
        if (tableInfo) {
            return {
                type: EntityInfoType.Table,
                tableInfo,
            };
        }
    }
    return {
        type: EntityInfoType.NoTable,
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
    const defScope = context.getDefinitionScope(tableName);
    const item = defScope?.getTableByName(tableName);
    const tableInfo = item && await tableInfoFromNode(item, context);

    if (tableInfo) {
        return {
            type: EntityInfoType.Table,
            tableInfo,
        };
    }

    const foreignTableInfo = await context.getForeignTableInfoByName(tableName, undefined);

    if (foreignTableInfo) {
        return {
            type: EntityInfoType.Table,
            tableInfo: foreignTableInfo,
        };
    }

    console.log('getEntityInfoFromTableName no table info found for', tableName, item, mrScope);
    // if (tableName === 't1') {
    //     debugger;
    //     mrScope?.getTableByName(tableName);
    // }

    return {
        type: EntityInfoType.NoTable,
        text: tableName,
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
            type: EntityInfoType.NoTable,
            text: node.getText(),
        };
    }

    return {
        type: EntityInfoType.Table,
        tableInfo,
    };
}

async function getEntityInfoFromCteStatement(
    node: ParserRuleContext,
    parent: CteStatementContext,
    context: IdentifierScope,
    mrScope?: MapReduceScope | null
) {
    const item = mrScope?.getTableByName(node.getText());
    const tableInfo = item && await tableInfoFromNode(item, context);
    if (!tableInfo) {
        return {
            type: EntityInfoType.NoTable,
            text: node.getText(),
        };
    }

    return {
        type: EntityInfoType.Table,
        tableInfo,
    };
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
        if (!item) {
            return {
                type: EntityInfoType.NoTable,
                text: printNode(parent),
            };
        }
        const tableInfo = await tableInfoFromNode(item, context);
        if (!tableInfo) {
            return {
                type: EntityInfoType.NoTable,
                text: printNode(parent),
            };
        }
        const columnInfo = getColumnInfoByName(tableInfo, columnName!);
        if (!columnInfo) {
            return {
                type: EntityInfoType.NoColumn,
                tableInfo,
                text: columnName,
            };
        }
        return {
            type: EntityInfoType.Column,
            tableInfo,
            columnInfo,
        };
    }

    const item = mrScope?.getTableByName(tableIdExp);
    const tableInfo = item && await tableInfoFromNode(item, context);
    if (!tableInfo) {
        return {
            type: EntityInfoType.NoTable,
            text: tableIdExp,
        };
    }
    const tableId = parent.poolPath()?.id_(0);
    if (node == tableId) {
        return {
            type: EntityInfoType.Table,
            tableInfo,
            text: tableIdExp,
        };
    }
    const columnInfo = getColumnInfoByName(tableInfo, columnName);
    if (!columnInfo) {
        return {
            type: EntityInfoType.NoColumn,
            tableInfo,
            text: columnName,
        };
    }
    return {
        type: EntityInfoType.Column,
        tableInfo,
        columnInfo,
    };
}

function getEntityInfoFromFunction(node: FunctionIdentifierContext) {
    return {
        type: EntityInfoType.Function,
        text: node.getText(),
    };
}


function getColumnInfoByName(tableInfo: TableInfo | null, columnName: string): ExtColumnInfo | null {
    if (!tableInfo || !columnName) {
        return null;
    }
    if (tableInfo.db_name == localDbId) {
        return {
            column_name: columnName,
            data_type_string: '',
            description: ''
        };
    }
    const columnInfo = tableInfo.column_list.find(c => c.column_name === columnName);
    return columnInfo || null;
}
