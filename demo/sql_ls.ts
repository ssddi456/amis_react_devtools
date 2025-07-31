import { type IRange, languages, type IMarkdownString, type Position, Uri } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContext, EntityContextType, HiveSQL, HiveSqlParserVisitor, } from 'dt-sql-parser';
import { AttrName } from 'dt-sql-parser/dist/parser/common/entityCollector';
import { posInRange } from "./ls_helper";
import { TextSlice } from "dt-sql-parser/dist/parser/common/textAndWord";
import { HiveSqlParser, SubQuerySourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import {
    TableSourceContext,
    VirtualTableSourceContext,
    QueryStatementExpressionContext,
} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import tableData from './data/example'
import { createContextManager, IdentifierScope } from "./context_manager";
import { printNode, rangeFromNode, printChildren, wordToRange, sliceToRange, findTokenAtPosition, printNodeTree } from "./sql_ls_helper";
import { tableRes, tableAndColumn, noTableInfoRes, noColumnInfoRes, createColumnRes, unknownRes } from "./sql_hover_res";
import { matchSubPath, matchSubPathOneOf, matchType } from "./sql_tree_query";

function tableInfoFromTableSource(
    tableSource: TableSourceContext | null,
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
    subQuerySource: any,
    collection?: TableInfo[]
): TableInfo | null {
    if (!subQuerySource) {
        return null;
    }
    const alias = subQuerySource.id_()?.getText();
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
        column_list: [],
        range: rangeFromNode(subQuerySource)
    };
    if (collection) {
        collection.push(ret);
    }
    return ret;

}

function tableInfoFromVirtualTableSource(
    virtualTableSource: VirtualTableSourceContext | null,
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
        column_list: []
    };
    if (collection) {
        collection.push(ret);
    }
    return ret;
}

function tableInfoFromNode(
    node: ParserRuleContext | null,
): TableInfo | null {
    if (!node) {
        return null;
    }
    const collection: TableInfo[] = [];
    if (node instanceof TableSourceContext) {
        return tableInfoFromTableSource(node, collection);
    } else if (node instanceof SubQuerySourceContext) {
        return tableInfoFromSubQuerySource(node, collection);
    } else if (node instanceof VirtualTableSourceContext) {
        return tableInfoFromVirtualTableSource(node, collection);
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


function isKeyWord(node: ParseTree, key: string): boolean {
    if (node instanceof TerminalNode) {
        return node.symbol.type === HiveSqlParser[`KW_${key.toUpperCase()}` as keyof typeof HiveSqlParser];
    }
    return false;
}


interface EntityInfo {
    type: 'table' | 'column' | 'unknown' | 'noTable' | 'noColumn' | 'createColumn';
    tableInfo?: TableInfo | null;
    columnInfo?: ColumnInfo | null;
    text?: string;
    range: IRange;
    ext?: string[];
}

const formatHoverRes = (hoverInfo: EntityInfo): languages.Hover => {
    switch (hoverInfo.type) {
        case 'table':
            return tableRes(hoverInfo.tableInfo!, hoverInfo.range, hoverInfo.ext);
        case 'column':
            return tableAndColumn(hoverInfo.tableInfo!, hoverInfo.columnInfo!, hoverInfo.range, hoverInfo.ext);
        case 'noTable':
            return noTableInfoRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext);
        case 'noColumn':
            return noColumnInfoRes(hoverInfo.tableInfo!, hoverInfo.text!, hoverInfo.range, hoverInfo.ext);
        case 'createColumn':
            return createColumnRes({ getText: () => hoverInfo.text! } as ParseTree, hoverInfo.range, hoverInfo.ext);
        case 'unknown':
        default:
            return unknownRes(hoverInfo.text!, hoverInfo.range, hoverInfo.ext);
    }
};

const formatDefinitionRes = (uri: Uri, hoverInfo: EntityInfo): languages.Definition | undefined => {
    console.log('formatDefinitionRes', uri, hoverInfo);
    if (
        (hoverInfo.type === 'table' || hoverInfo.type === 'column')
        && hoverInfo.tableInfo && hoverInfo.tableInfo.range
    ) {
        return {
            uri,
            range: hoverInfo.tableInfo.range
        };
    }
    return;
};

// 这里列一下表
// hive is from
// https://github.com/DTStack/dt-sql-parser/blob/main/src/grammar/hive/HiveSqlParser.g4
//
export const createHiveLs = (model: {
    uri: { toString: () => string; };
    getValue: () => string;
}) => {

    const document = TextDocument.create(model.uri.toString(), 'hivesql', 0, model.getValue());
    const hiveSqlParse = new HiveSQL();
    const sqlSlices = hiveSqlParse.splitSQLByStatement(document.getText());

    const getCtxFromPos = (position: Position) => {
        if (!sqlSlices || sqlSlices.length === 0) {
            return null;
        }
        for (let i = 0; i < sqlSlices.length; i++) {
            const slice = sqlSlices[i];
            if (posInRange(position, sliceToRange(slice))) {
                const text = paddingSliceText(slice, document.getText());
                console.log('getCtxFromPos text', '-->' + text + '<--');
                const ctx = hiveSqlParse.createParser(document.getText());
                const tree = ctx.program();
                const foundNode = findTokenAtPosition(position, tree);
                const contextManaer = createContextManager(tree);
                const context = contextManaer.getContextByPosition(position);
                return {
                    foundNode,
                    context,
                };
            }
        }
        return null;
    };

    const getTableAndColumnInfoAtPosition = (
        foundNode: ParserRuleContext,
        position: Position,
        context: IdentifierScope,
        isTest?: boolean
    ): EntityInfo | null => {
        const ext: string[] = [];
        const pushExt = isTest ? (content: string) => {
            ext.push(content);
        } : () => { };
        pushExt((position as any).text);
        pushExt(printNodeTree(foundNode));

        const allIdentifiers = context.getAllIdentifiers() || {};

        const parent = foundNode.parent!;
        console.log('do hover entities', printNode(parent), position, allIdentifiers.keys());

        if (parent.ruleIndex === HiveSqlParser.RULE_tableSource) {
            const tableIdExp = parent.children![0].getText();
            const item = allIdentifiers.get(tableIdExp);
            const tableInfo = item && tableInfoFromNode(item);

            const range = rangeFromNode(foundNode);
            return {
                type: tableInfo ? 'table' : 'noTable',
                tableInfo,
                text: tableIdExp,
                range,
                ext
            };
        }

        if (
            matchSubPathOneOf(foundNode, [
                ['id_', 'tableName'],
                ['DOT', 'tableName']
            ])
        ) {
            const tableName = parent.getText();
            const item = allIdentifiers.get(tableName);
            const tableInfo = item && tableInfoFromNode(item);

            pushExt(`do hover tableName ${printNode(parent)}, 'tableIdExp', ${tableName}, 'tableInfo', ${JSON.stringify(tableInfo)}`);
            const range = rangeFromNode(foundNode);

            if (!tableInfo) {
                return {
                    type: 'noTable',
                    text: tableName,
                    range,
                    ext
                };
            }

            return {
                type: 'table',
                tableInfo,
                range,
                ext
            };
        }

        if (parent.ruleIndex === HiveSqlParser.RULE_viewName) {
            return {
                type: 'unknown',
                text: foundNode.getText(),
                range: rangeFromNode(foundNode),
                ext
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

            const range = rangeFromNode(foundNode);

            // column_name only
            if (!tableIdExp) {
                const item = context.getDefaultIdentifier();
                const tableInfo = item && tableInfoFromNode(item);
                if (!tableInfo) {
                    return {
                        type: 'noTable',
                        text: printNode(parent),
                        range,
                        ext
                    };
                }
                const columnInfo = getColumnInfoByName(tableInfo, columnName);
                if (!columnInfo) {
                    return {
                        type: 'noColumn',
                        tableInfo,
                        text: columnName,
                        range,
                        ext
                    };
                }
                return {
                    type: 'column',
                    tableInfo,
                    columnInfo,
                    range,
                    ext
                };
            }
            const item = allIdentifiers.get(tableIdExp);
            const tableInfo = item && tableInfoFromNode(item);

            if (!tableInfo) {
                return {
                    type: 'noTable',
                    text: tableIdExp,
                    range,
                    ext
                };
            }
            const columnInfo = getColumnInfoByName(tableInfo, columnName);
            if (!columnInfo) {
                return {
                    type: 'noColumn',
                    tableInfo,
                    text: columnName,
                    range,
                    ext
                };
            }
            return {
                type: 'column',
                tableInfo,
                columnInfo,
                range,
                ext
            };
        }

        if (matchSubPath(foundNode, ['id_', 'selectItem'])) {
            if (foundNode === parent.children?.[2]
                && isKeyWord(parent.children[1]!, 'as')
            ) {
                return {
                    type: 'createColumn',
                    text: foundNode.getText(),
                    range: rangeFromNode(foundNode),
                    ext
                };
            }
            return {
                type: 'unknown',
                text: foundNode.getText(),
                range: rangeFromNode(foundNode),
                ext
            };
        }

        if (matchSubPath(foundNode, ['id_', 'subQuerySource'])) {
            // pushExt(`entities ${JSON.stringify(entities, null, 2)}`)
            // pushExt(`currentEntities${JSON.stringify(currentEntities, null, 2)}`);
            return {
                type: 'unknown',
                text: foundNode.getText(),
                range: rangeFromNode(foundNode),
                ext
            };
        }

        return {
            type: 'unknown',
            text: foundNode.getText(),
            range: rangeFromNode(foundNode),
            ext
        };
    };

    return {
        doComplete: (position: Position) => {
            getCtxFromPos(position);
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;

            console.log('do completes syntaxSuggestions', syntaxSuggestions);
            if (!syntaxSuggestions) {
                return;
            }

            const table = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.TABLE);
            if (table) {
                // 这里搞一下找表名
            }
            const column = syntaxSuggestions.find(s => s.syntaxContextType === EntityContextType.COLUMN);
            if (column) {
                const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
                const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);
                console.log("do completes currentEntities", currentEntities);
                if (currentEntities.length > 0
                    && currentEntities[0].entityContextType === EntityContextType.TABLE
                ) {
                    const cursorRange = {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    };
                    let range = wordToRange(column.wordRanges[0]) || cursorRange;
                    // check if is table_name.column_name
                    if (column.wordRanges[1]?.text === '.') {
                        if (column.wordRanges[2]) {
                            range = wordToRange(column.wordRanges[2])!;
                        } else {
                            range = {
                                startLineNumber: position.lineNumber,
                                startColumn: position.column + 1,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column + 1
                            };
                        }
                    }
                    console.log("do completes range", range);
                    return {
                        suggestions: [
                            {
                                label: `column test`,
                                sortText: '$$test',
                                kind: languages.CompletionItemKind.Field,
                                insertText: 'test',
                                range,
                                documentation: {
                                    value: [
                                        `**Table:** ${currentEntities[0].text}`,
                                        `**Column:** test`
                                    ].join('\n\n'),
                                    isTrusted: true
                                } as IMarkdownString
                            }
                        ]
                    };
                }
            }
        },
        doHover: (
            position: Position,
            isTest?: boolean
        ): languages.Hover | undefined => {
            const { foundNode, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
                && !matchType(foundNode, 'columnNamePath')
                && !matchType(foundNode, 'poolPath')
                && !matchType(foundNode, 'constant')
                && !matchType(foundNode, 'select')
            )) {
                return;
            }

            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, position, context, isTest);
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

        doValidation() {
            const errors = hiveSqlParse.validate(document.getText());
            if (errors.length === 0) {
                return [];
            }
            return errors.map(err => {
                return {
                    message: err.message,
                    range: sliceToRange(err)
                };
            });
        },

        doDefinition: (
            position: Position,
            isTest?: boolean
        ): languages.Definition | undefined => {
            // TODO: implement definition functionality
            const { foundNode, context } = getCtxFromPos(position) || {};
            if (!foundNode || !context || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
                && !matchType(foundNode, 'columnNamePath')
                && !matchType(foundNode, 'poolPath')
                && !matchType(foundNode, 'constant')
                && !matchType(foundNode, 'select')
            )) {
                return;
            }

            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, position, context, isTest);
            if (!hoverInfo) {
                return;
            }

            return formatDefinitionRes(model.uri as Uri, hoverInfo);
        }
    };
}
