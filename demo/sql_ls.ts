import { editor, type IRange, languages, Position, Uri, MarkerSeverity } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContext, HiveSQL, } from 'dt-sql-parser';
import { AttrName } from 'dt-sql-parser/dist/parser/common/entityCollector';
import { posInRange, WithSource } from "./ls_helper";
import { TextSlice } from "dt-sql-parser/dist/parser/common/textAndWord";
import { CteStatementContext, FunctionIdentifierContext, HiveSqlParser, ProgramContext, SelectItemContext, SubQuerySourceContext, TableNameContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import {
    TableSourceContext,
    VirtualTableSourceContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import tableData from './data/example'
import { ContextManager, createContextManager } from "./context_manager";
import { IdentifierScope } from "./Identifier_scope";
import { printNode, rangeFromNode, wordToRange, sliceToRange, findTokenAtPosition, printNodeTree } from "./sql_ls_helper";
import { tableRes, tableAndColumn, noTableInfoRes, noColumnInfoRes, createColumnRes, unknownRes, functionRes } from "./sql_hover_res";
import { matchSubPath, matchSubPathOneOf, matchType } from "./sql_tree_query";
import { formatHiveSQL } from './formatter';
import { position } from "amis";
import { MapReduceScope } from "./mr_scope";

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

function tableInfoFromNode(
    node: ParserRuleContext | null,
    context: IdentifierScope,
    mrScope?: MapReduceScope | null,
): TableInfo | null {
    if (!node) {
        return null;
    }
    console.log('tableInfoFromNode find by node', printNode(node));

    const collection: TableInfo[] = [];
    if (node instanceof TableSourceContext) {
        const tableOrView = node.tableOrView();
        const alias = node.id_();

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
    }
}

export interface ColumnInfo {
    column_name: string;
    data_type_string: string;
    description: string;
}

function getTableInfoByName(
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

function getColumnInfoByName(tableInfo: TableInfo | null, columnName: string): ColumnInfo | null {
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

function paddingSliceText(slice: TextSlice, full: string): string {
    const text = slice.text;
    if (slice.startIndex > 1) {
        const before = full.slice(0, slice.startIndex).replace(/[^\n]/g, ' ');
        return before + text;
    }
    return text
}

interface EntityInfo {
    type: 'table' | 'column' | 'unknown' | 'noTable' | 'noColumn' | 'createColumn' | 'function';
    tableInfo?: TableInfo | null;
    columnInfo?: ColumnInfo | null;
    text?: string;
    range: IRange;
    ext?: string[];
    __source?: {
        fileName: string,
        lineNumber: number,
        columnNumber: number
    }
}

const formatHoverRes = (hoverInfo: EntityInfo): WithSource<languages.Hover> => {
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

const formatDefinitionRes = (uri: Uri, hoverInfo: EntityInfo): WithSource<languages.Definition> | undefined => {
    console.log('formatDefinitionRes', uri, hoverInfo);
    if (
        (hoverInfo.type === 'table' || hoverInfo.type === 'column')
        && hoverInfo.tableInfo && hoverInfo.tableInfo.range
    ) {
        return {
            uri,
            range: hoverInfo.tableInfo.range,
            __source: hoverInfo.__source
        };
    }
    return;
};


const getTableAndColumnInfoAtPosition = (
    foundNode?: ParserRuleContext | null,
    mrScope?: MapReduceScope | null,
    context?: IdentifierScope | null,
    isTest?: boolean
): EntityInfo | null => {
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
    if (matchSubPathOneOf(foundNode, [
        ['id_', 'tableSource'],
    ])) {
        const tableName = (parent as TableSourceContext).tableOrView().tableName()?.getText();
        if (tableName) {
            const item = mrScope?.getTableByName(tableName);
            const tableInfo = item && tableInfoFromNode(item, context, mrScope);
            if (tableInfo) {
                return {
                    type: 'table',
                    tableInfo,
                    ...commonFields,
                };
            }
        }
        return {
            type: 'noTable',
            text: foundNode.getText(),
            ...commonFields,
        };
    }
    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1418
    if (
        matchSubPathOneOf(foundNode, [
            ['id_', 'tableName'],
            ['DOT', 'tableName']
        ])
    ) {
        const tableName = parent.getText();
        const item = mrScope?.getTableByName(tableName);
        const tableInfo = item && tableInfoFromNode(item, context, mrScope);

        pushExt(`do hover tableName ${printNode(parent)}, 'tableIdExp', ${tableName}, 'tableInfo', ${JSON.stringify(tableInfo)}`);

        if (!tableInfo) {
            return {
                type: 'noTable',
                text: tableName,
                ...commonFields,
            };
        }

        return {
            type: 'table',
            tableInfo,
            ...commonFields,
        };
    }

    // https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4#L1436
    if (
        matchSubPathOneOf(foundNode, [
            ['id_', 'subQuerySource'],
        ])
    ) {
        const item = mrScope?.getTableByName(foundNode.getText());
        const tableInfo = item && tableInfoFromNode(item, context, mrScope);
        if (!tableInfo) {
            return {
                type: 'unknown',
                text: foundNode.getText(),
                ...commonFields,
            };
        }

        return {
            type: 'table',
            tableInfo,
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
    if (
        matchSubPathOneOf(foundNode, [
            ['id_', 'poolPath', 'columnName'],
            ['id_', 'poolPath', 'columnNamePath'],
            ['DOT', 'poolPath', 'columnNamePath']
        ])
    ) {
        // 只支持 table_name.column_name or column_name for now
        const tableIdExp = parent.children?.length === 1 ? undefined : parent.children![0].getText();
        const columnName = parent.children?.length === 1 ? parent.children![0].getText() : parent.children![2].getText();

        // column_name only
        if (!tableIdExp) {
            const item = mrScope?.getTableByName(mrScope?.getDefaultInputTableName());
            const tableInfo = item && tableInfoFromNode(item, context, mrScope);
            if (!tableInfo) {
                return {
                    type: 'noTable',
                    text: printNode(parent),
                    ...commonFields,
                };
            }
            const columnInfo = getColumnInfoByName(tableInfo, columnName);
            if (!columnInfo) {
                return {
                    type: 'noColumn',
                    tableInfo,
                    text: columnName,
                    ...commonFields,
                };
            }
            return {
                type: 'column',
                tableInfo,
                columnInfo,
                ...commonFields,
            };
        }

        const item = mrScope?.getTableByName(tableIdExp);
        const tableInfo = item && tableInfoFromNode(item, context, mrScope);
        console.log('tableIdExp', tableIdExp, 'context', context, 'mrScope', mrScope, 'mrScope?.getTableByName()', mrScope?.getTableByName(tableIdExp), 'item', item)

        if (!tableInfo) {
            console.log('No table info found for:', printNode(item));
            return {
                type: 'noTable',
                text: tableIdExp,
                ...commonFields,
            };
        }
        const columnInfo = getColumnInfoByName(tableInfo, columnName);
        if (!columnInfo) {
            return {
                type: 'noColumn',
                tableInfo,
                text: columnName,
                ...commonFields,
            };
        }
        return {
            type: 'column',
            tableInfo,
            columnInfo,
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
        const parent = foundNode.parent! as FunctionIdentifierContext;
        return {
            type: 'function',
            text: foundNode.getText(),
            ...commonFields,
        };
    }

    return {
        type: 'unknown',
        text: foundNode.getText(),
        ...commonFields,
    };
};

const getIdentifierReferences = (
    foundNode: ParserRuleContext,
    mrScope: MapReduceScope | null | undefined,
    context: IdentifierScope,
): ParserRuleContext[] | undefined => {
    const foundTableSource = matchSubPathOneOf(foundNode, [
        ['id_','tableSource'],
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
}

interface ContextInfos {
    hiveSqlParse: HiveSQL;
    sqlSlices: ReturnType<HiveSQL['splitSQLByStatement']>;
    tree: ProgramContext;
    contextManager: ContextManager;
}

const contextCache = new Map<string, ContextInfos>();

function getContextWithCache(text: string, noCache: boolean): ContextInfos {
    if (contextCache.has(text) && !noCache) {
        return contextCache.get(text)!;
    }
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(text);
    const ctx = hiveSqlParse.createParser(text);
    const tree = ctx.program();
    const contextManager = createContextManager(tree);
    const ret: ContextInfos = {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    };
    contextCache.set(text, ret);
    return ret;
}

// 这里列一下表
// hive is from
// https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4
//
export const createHiveLs = (
    model: {
        uri: { toString: () => string; };
        getValue: () => string;
    },
    isTest: boolean = false,
    noCache: boolean = false,
) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const  {
        hiveSqlParse,
        sqlSlices,
        tree,
        contextManager
    } = getContextWithCache(document.getText(), noCache);

    const logSource = (arg: any) => {
        if (arg && '__source' in arg) {
            const source = arg.__source;
            console.log(`vscode://file/${source.fileName}:${source.lineNumber}:${source.columnNumber}`);
        }
    };
    const logger: (...args: any[]) => void = isTest ?  console.log : () => { };

    logger('getCtxFromPos foundNode', contextManager.toString());

    const getCtxFromPos = (position: Position) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return null;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                // const text = paddingSliceText(slice, document.getText());
                // logger('getCtxFromPos text', '-->' + text + '<--');
                const foundNode = findTokenAtPosition(position, tree);
                const context = contextManager.getContextByPosition(position);
                const mrScope = context?.getMrScope()?.getScopeByPosition(position) || null;

                logger('getCtxFromPos mrScope', '-->', mrScope, '<--');
                return {
                    foundNode,
                    context,
                    mrScope,
                };
            }
        }
        return null;
    };

    return {
        doComplete: (position: Position) => {
            const { foundNode, context } = getCtxFromPos(position) || {};

            // how?
        },
        doHover: (
            position: Position,
            isTest?: boolean
        ) => {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, mrScope, context, isTest);
            logger('getTableAndColumnInfoAtPosition', hoverInfo);
            logSource(hoverInfo);
            if (!hoverInfo) {
                return;
            }

            return formatHoverRes(hoverInfo);
        },

        doSyntaxHover: (
            position: Position,
        ): languages.Hover | undefined => {
            const { foundNode, context } = getCtxFromPos(position) || {};
            if (!foundNode) {
                return;
            }
            const text = printNodeTree(foundNode, '\n\n');
            const range = rangeFromNode(foundNode);

            return {
                contents: [{ value: text }],
                range
            };
        },

        doValidation(): WithSource<editor.IMarkerData>[] {
            const validations: editor.IMarkerData[] = [];
            
            const SyntaxErrors = hiveSqlParse.validate(document.getText());
            SyntaxErrors.forEach(err => {
                validations.push({
                    severity: MarkerSeverity.Error,
                    ...sliceToRange(err),
                    message: err.message
                })
            });

            contextManager.rootContext?.referenceNotFound.forEach(refs => {
                if (
                    !(refs[0] instanceof TableSourceContext) ||
                    !tableInfoFromNode(refs[0], contextManager.rootContext!)
                ) {
                    refs.forEach(ref => {
                        validations.push({
                            severity: MarkerSeverity.Error,
                            ...rangeFromNode(ref),
                            message: `Reference not found: ${ref.getText()}`,
                        });
                    });
                }
            });

            const errors = contextManager.rootContext?.validate() || [];
            errors.forEach(err => {
                validations.push({
                    severity: MarkerSeverity.Error,
                    ...rangeFromNode(err.context),
                    message: err.message
                })
            });

            const ranges = contextManager.rootContext?.getHighlights() || [];
            ranges.forEach(x => {
                const position = new Position(x.lineNumber, x.column);
                const { foundNode, mrScope, context } = getCtxFromPos(position) || {};

                const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, mrScope, context, isTest);
                if (!hoverInfo) {
                    validations.push({
                        severity: MarkerSeverity.Error,
                        startLineNumber: x.lineNumber,
                        startColumn: x.column,
                        endLineNumber: x.lineNumber,
                        endColumn: x.column + (x.end - x.start),
                        message: `Reference not found: ${printNode(foundNode)}`,
                    });
                    return;
                }
                if (
                    hoverInfo.type == 'unknown'
                     || hoverInfo.type == 'noTable'
                     || hoverInfo.type == 'noColumn'
                ) {
                    const res = formatHoverRes(hoverInfo);
                    validations.push({
                        severity: MarkerSeverity.Error,
                        ...rangeFromNode(foundNode!),
                        message: res.contents[0].value,
                    });
                }
            })
            return validations;
        },

        doDefinition: (
            position: Position,
            isTest?: boolean
        ) => {
            // TODO: implement definition functionality
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            

            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, mrScope, context, isTest);
            if (!hoverInfo) {
                return;
            }

            return formatDefinitionRes(model.uri as Uri, hoverInfo);
        },

        doReferences(
            position: Position,
            isTest?: boolean
        ): WithSource<languages.Location[]> | undefined {
            const { foundNode, mrScope, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
            )) {
                return;
            }

            const references = getIdentifierReferences(foundNode, mrScope, context);
            if (!references || references.length === 0) {
                return;
            }

            return references.map(ref => ({
                uri: model.uri as Uri,
                range: rangeFromNode(ref),
            }));
        },
        formatHiveSQL(sql: string): string{
            const formatted = formatHiveSQL(sql);
            return formatted;
        },
        getContextManager: () => {
            return contextManager
        },
    };
}
