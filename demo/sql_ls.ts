import { type IRange, languages, type IMarkdownString, type Position, Uri } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContext, EntityContextType, HiveSQL, HiveSqlParserVisitor, } from 'dt-sql-parser';
import { AttrName } from 'dt-sql-parser/dist/parser/common/entityCollector';
import { posInRange } from "./ls_helper";
import { TextSlice } from "dt-sql-parser/dist/parser/common/textAndWord";
import { HiveSqlParser } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import type {
    ProgramContext,
    FromClauseContext,
    JoinSourceContext,
    AtomjoinSourceContext,
    JoinSourcePartContext,
    TableSourceContext,
    VirtualTableSourceContext,
    QueryStatementExpressionContext} from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext, ParseTree, RuleContext, TerminalNode } from "antlr4ng";
import tableData from './data/example'
import { createContextManager } from "./context_manager";
import { printNode, rangeFromNode, printChildren, wordToRange, sliceToRange, findTokenAtPosition, printNodeTree } from "./sql_ls_helper";

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


function collectTableInfoFromSelect(node: ParserRuleContext | null): TableInfo[] | null {
    if (!node) {
        return null;
    }
    if (matchType(node, 'atomSelectStatement')) {
        const result: TableInfo[] = [];
        let foundTopLevelFrom = false;

        const visitor = new class extends HiveSqlParserVisitor<any> {
            visitFromClause = (ctx: FromClauseContext) => {
                if (foundTopLevelFrom) {
                    return;
                }
                foundTopLevelFrom = true;

                const joinSource = ctx.fromSource().joinSource()
                if (!joinSource) {
                    console.warn('Unexpected token, expected JOIN source:', printNode(joinSource as any));
                    return;
                }

                this.visitJoinSource(joinSource);
            }

            visitJoinSource = (ctx: JoinSourceContext) => {

                console.log('collectTableInfo visitJoinSource +', printChildren(ctx as any));
                this.visitAtomjoinSource(ctx.atomjoinSource());
                const parts = ctx.joinSourcePart();
                for (let i = 0; i < parts.length; i++) {
                    this.visitJoinSourcePart(parts[i]);
                }
            }

            visitAtomjoinSource = (ctx: AtomjoinSourceContext) => {
                if (ctx.tableSource()) {
                    tableInfoFromTableSource(ctx.tableSource(), result);
                    return;
                }

                if (ctx.subQuerySource()) {
                    const subQuerySource = ctx.subQuerySource()!;
                    tableInfoFromSubQuerySource(subQuerySource, result);
                    return;
                }

                if (ctx.virtualTableSource()) {
                    tableInfoFromVirtualTableSource(ctx.virtualTableSource(), result);
                    return;
                }

                if (ctx.joinSource()) {
                    const joinSource = ctx.joinSource()!;
                    this.visitJoinSource(joinSource);
                    return;
                }
            }

            visitJoinSourcePart = (ctx: JoinSourcePartContext) => {
                if (ctx.tableSource()) {
                    tableInfoFromTableSource(ctx.tableSource(), result);
                    return;
                }

                if (ctx.subQuerySource()) {
                    tableInfoFromSubQuerySource(ctx.subQuerySource(), result);
                    return;
                }

                if (ctx.virtualTableSource()) {
                    tableInfoFromVirtualTableSource(ctx.virtualTableSource(), result);
                    return;
                }
            }
        }
        visitor.visit(node);
        if (result.length > 0) {
            return result;
        }
    }
    return null;
}

function collectTableInfoFromWithClause(node: ParserRuleContext | null): TableInfo[] | null {
    if (!node) {
        return null;
    }
    if (matchType(node, 'withClause')) {
        const result: TableInfo[] = [];
        const visitor = new class extends HiveSqlParserVisitor<any> {
            visitTableSource = (ctx: TableSourceContext) => {
                tableInfoFromTableSource(ctx, result);
            }
        };
        visitor.visit(node);
        if (result.length > 0) {
            return result;
        }
    }
    return null;
}

interface TableInfo {
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

interface ColumnInfo {
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


const noTableInfoRes = (text: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [`table not found: ${text}`, ...(ext || [])].filter(Boolean).join('\n')
        },
    ],
    range,
});
const noColumnInfoRes = (table: TableInfo, columnName: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `column: ${columnName} not found in table ${table.table_name}`,
                ...(ext || [])].filter(Boolean).join('\n')
        },
    ],
    range,
});
const tableAndColumn = (table: TableInfo, column: ColumnInfo, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description,
                `**Column:** ${column.column_name} [${column.data_type_string}]`,
                column.description,
                ...(ext || [])
            ].filter(Boolean).join('\n\n'),
        },
    ],
    range,
});
const tableRes = (table: TableInfo, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**Table:** ${table.table_name}`,
                table.description,
                ...(ext || [])
            ].filter(Boolean).join('\n\n')
        },
    ],
    range,
});

const unknownRes = (text: string, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `unknown: ${text}`,
                ...(ext || [])
            ].filter(Boolean).join('\n')
        },
    ],
    range,
});

const createColumnRes = (node: ParseTree, range: IRange, ext?: string[]) => ({
    contents: [
        {
            value: [
                `**create Column:** ${node.getText()}`,
                ...(ext || [])
            ].filter(Boolean).join('\n\n')
        },
    ],
    range,
});

function matchType(node: ParseTree, ruleIndex: number | string): boolean {
    if (ruleIndex === '*') {
        return true;
    }
    if (node instanceof TerminalNode) {
        if (typeof ruleIndex === 'string') {
            return node.symbol.type === HiveSqlParser[`KW_${ruleIndex.toUpperCase()}` as keyof typeof HiveSqlParser]
                || node.symbol.type === HiveSqlParser[ruleIndex as keyof typeof HiveSqlParser];
        }
        return node.symbol.type === ruleIndex;
    }
    ruleIndex = (typeof ruleIndex === 'string'
        ? (HiveSqlParser[`RULE_${ruleIndex}` as keyof typeof HiveSqlParser] || -1)
        : ruleIndex) as number;

    if (node instanceof RuleContext) {
        return node.ruleIndex === ruleIndex;
    }
    return false;
}

// from buttom to top
function matchSubTree(node: ParserRuleContext, ruleIndex: number[] | string[]): ParserRuleContext | null {
    const checkedRuleIndex = ruleIndex.slice(0);
    let parent = node.parent;

    if (checkedRuleIndex[0] === '*') {
        const nextRule = checkedRuleIndex[1];
        if (nextRule === '*' || nextRule === '?') {
            throw new Error(`'*' or '?' should not be used after '*' in ruleIndex: ${ruleIndex}`);
        }
        while (parent) {
            if (matchType(parent, nextRule)) {
                break;
            }
            parent = parent.parent;
        }
        if (!parent) {
            return null;
        }
        checkedRuleIndex.shift();
    } else if (!matchType(node, checkedRuleIndex[0])) {
        return null;
    }
    checkedRuleIndex.shift();
    while (checkedRuleIndex.length > 0 && parent) {
        if (checkedRuleIndex[0] === '?') {
            const nextRule = checkedRuleIndex[1];
            if (!nextRule) {
                return parent;
            }
            parent = parent?.parent || null;
            checkedRuleIndex.shift();
            continue;
        }
        if (checkedRuleIndex[0] === '*') {
            const nextRule = checkedRuleIndex[1];
            if (nextRule === '*' || nextRule === '?') {
                throw new Error(`'*' or '?' should not be used after '*' in ruleIndex: ${ruleIndex}`);
            }
            while (parent) {
                if (matchType(parent, nextRule)) {
                    break;
                }
                parent = parent.parent;
            }
            if (!parent) {
                return null;
            }
            checkedRuleIndex.shift();
        }
        if (!matchType(parent, checkedRuleIndex[0])) {
            return null;
        }
        const nextRule = checkedRuleIndex[1];
        if (!nextRule) {
            break;
        }
        parent = parent.parent;
        checkedRuleIndex.shift();
    }
    return parent;
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
        isTest?: boolean
    ): EntityInfo | null => {
        const parent = foundNode.parent!;
        const ext: string[] = [];
        const pushExt = isTest ? (content: string) => {
            ext.push(content);
        } : () => { };
        pushExt((position as any).text);
        pushExt(printNodeTree(foundNode));

        const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
        const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);
        const currentTableEntities = currentEntities.filter(e => e.entityContextType === EntityContextType.TABLE);

        const selectStmt = matchSubTree(foundNode, ['id_', '*', 'atomSelectStatement']);
        let extTableInfo = collectTableInfoFromSelect(selectStmt);

        const isInFromClause = matchSubTree(foundNode, ['*', 'fromClause', '*', 'atomSelectStatement']) === selectStmt;
        if (isInFromClause) {
            const currentFromClause = matchSubTree(foundNode, ['*', 'queryStatementExpression']) as QueryStatementExpressionContext;
            extTableInfo = collectTableInfoFromWithClause(currentFromClause.withClause()) || [];
        }

        console.log('do hover entities', printNode(parent), position, currentEntities);

        if (parent.ruleIndex === HiveSqlParser.RULE_tableSource) {
            const tableIdExp = parent.children![0].getText();
            const tableInfo = getTableInfoByName(tableIdExp, undefined, currentTableEntities, extTableInfo);
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
            matchSubTree(foundNode, ['id_', 'tableName'])
            || matchSubTree(foundNode, ['DOT', 'tableName'])
        ) {
            const dbName = parent.children?.length === 3 ? parent.children![0].getText() : undefined;
            const tableName = parent.children?.length === 3 ? parent.children![2].getText() : parent.children![0].getText();

            const tableInfo = getTableInfoByName(tableName, dbName, currentTableEntities, extTableInfo);
            pushExt(`do hover tableName ${printNode(parent)}, 'tableIdExp', ${tableName}, 'tableInfo', ${JSON.stringify(tableInfo)}`);
            const range = rangeFromNode(foundNode);

            if (!tableInfo) {
                if (
                    matchSubTree(foundNode, ['id_', 'tableName', 'tableOrView', 'tableSource'])
                    || matchSubTree(foundNode, ['DOT', 'tableName', 'tableOrView', 'tableSource'])
                ) {
                    // to found cte source
                    const cteTables = entities.filter(e => e.entityContextType === EntityContextType.TABLE);
                    const cteTable = cteTables.find(e => e.text === tableName);
                    if (cteTable) {
                        return {
                            type: 'table',
                            tableInfo: {
                                db_name: '',
                                table_name: cteTable.text,
                                table_id: 0,
                                description: 'cte table',
                                column_list: [] // 这咋整
                            },
                            range,
                            ext
                        };
                    }
                    return {
                        type: 'unknown',
                        text: tableName,
                        range,
                        ext
                    };
                }
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
            matchSubTree(foundNode, ['id_', 'poolPath', 'columnName'])
            || matchSubTree(foundNode, ['id_', 'poolPath', 'columnNamePath'])
            || matchSubTree(foundNode, ['DOT', 'poolPath', 'columnNamePath'])
        ) {
            // 只支持 table_name.column_name or column_name for now
            const tableIdExp = parent.children?.length === 1 ? undefined : parent.children![0].getText();
            const columnName = parent.children?.length === 1 ? parent.children![0].getText() : parent.children![2].getText();

            const range = rangeFromNode(foundNode);

            // column_name only
            if (!tableIdExp) {
                const tableInfo = getTableInfoByName(currentEntities[0].text, undefined, currentTableEntities, extTableInfo);
                if (!tableInfo) {
                    return {
                        type: 'noTable',
                        text: currentEntities[0].text,
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


            // pushExt(`do hover selectStmt ${printNode(selectStmt)}`);
            // pushExt(`do hover extTableInfo ${JSON.stringify(extTableInfo, null, 2)}`);

            const tableInfo = getTableInfoByName(tableIdExp, undefined, currentTableEntities, extTableInfo);
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

        if (matchSubTree(foundNode, ['id_', 'selectItem'])) {
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

        if (matchSubTree(foundNode, ['id_', 'subQuerySource'])) {
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
            if (!foundNode || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
                && !matchType(foundNode, 'columnNamePath')
                && !matchType(foundNode, 'poolPath')
                && !matchType(foundNode, 'constant')
                && !matchType(foundNode, 'select')
            )) {
                return;
            }
            console.log("getAllIdentifiers", context?.getAllIdentifiers());

            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, position, isTest);
            if (!hoverInfo) {
                return;
            }

            return formatHoverRes(hoverInfo);
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
            if (!foundNode || (
                !matchType(foundNode, 'id_')
                && !matchType(foundNode, 'DOT')
                && !matchType(foundNode, 'columnNamePath')
                && !matchType(foundNode, 'poolPath')
                && !matchType(foundNode, 'constant')
                && !matchType(foundNode, 'select')
            )) {
                return;
            }

            const hoverInfo = getTableAndColumnInfoAtPosition(foundNode, position, isTest);
            console.log("getAllIdentifiers", context?.getAllIdentifiers());

            if (!hoverInfo) {
                return;
            }

            return formatDefinitionRes(model.uri as Uri, hoverInfo);
        }
    };
}
