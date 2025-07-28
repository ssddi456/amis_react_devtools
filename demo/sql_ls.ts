import { type IRange, languages, type IMarkdownString,  type Position } from "monaco-editor";
import { TextDocument } from 'vscode-json-languageservice';
import { EntityContext, EntityContextType, HiveSQL, HiveSqlParserVisitor } from 'dt-sql-parser';
import { AttrName } from 'dt-sql-parser/dist/parser/common/entityCollector';
import { posInRange } from "./ls_helper";
import { TextSlice, WordRange } from "dt-sql-parser/dist/parser/common/textAndWord";
import { ProgramContext, HiveSqlParser, FromClauseContext, FromSourceContext, JoinSourceContext, AtomjoinSourceContext, JoinSourcePartContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import tableData from './data/example'

function sliceToRange(slice: {
    readonly startLine: number;
    /** end at ..n */
    readonly endLine: number;
    /** start at 1 */
    readonly startColumn: number;
    /** end at ..n + 1 */
    readonly endColumn: number;
}) {
    return {
        startLineNumber: slice.startLine,
        startColumn: slice.startColumn,
        endLineNumber: slice.endLine,
        endColumn: slice.endColumn
    };
}

function wordToRange(slice?: WordRange): IRange | undefined {
    if (!slice) {
        return undefined;
    }
    return {
        startLineNumber: slice.line,
        startColumn: slice.startColumn,
        endLineNumber: slice.line,
        endColumn: slice.endColumn
    };
}

function isPosInParserRuleContext(position: Position, context: ParserRuleContext | TerminalNode): boolean {
    const lineNumber = position.lineNumber;
    const column = position.column - 1;
    
    if (context instanceof TerminalNode) {
        if (context.symbol.type === HiveSqlParser.Identifier) {
            return false;
        }
        if (context.symbol.line === lineNumber) {
            if (context.symbol.column <= column
                && context.symbol.column + (context.symbol.text || '').length > column
            ) {
                return true;
            }
        }
        return false;
    }
    const startToken = context.start;
    const endToken = context.stop;
    if (!startToken || !endToken) {
        return false;
    }
    let startLine = startToken.line;
    let startColumn = startToken.column;
    let endLine = endToken.line;
    let endColumn = endToken.column;

    if (context.ruleIndex === HiveSqlParser.RULE_id_) {
        endColumn = startColumn + (context.getText ? context.getText().length : 0);
    }

    if (lineNumber === startLine && column >= startColumn && lineNumber === endLine && column < endColumn) {
        return true;
    }

    if (lineNumber === startLine && lineNumber !== endLine && column >= startColumn) {
        return true;
    }

    if (lineNumber !== startLine && lineNumber === endLine && column < endColumn) {
        return true;
    }

    if (lineNumber > startLine && lineNumber < endLine) {
        return true;
    }
    return false;
}

function printNode(node: ParserRuleContext | TerminalNode | null): string {
    if (!node) {
        return 'null';
    }
    if (node instanceof TerminalNode) {
        return `TerminalNode(${ruleIndexToDisplayName(node)}, ${node.symbol.line}:${node.symbol.column})`;
    }
    const range = rangeFromNode(node);
    const start = `${range.startLineNumber}:${range.startColumn}`;
    const end = `${range.endLineNumber}:${range.endColumn}`;

    return `Node(${ruleIndexToDisplayName(node)}, ${start} -> ${end})`;
}

function printChildren(node: ParserRuleContext | null): string {
    if (!node) {
        return 'null';
    }
    const children = node.children || [];
    return `Children: \n${(children as any[]).map(printNode).join(', \n')}`;
}

function printNodeTree(node: ParserRuleContext | null): string {
    if (!node) {
        return 'null';
    }
    const result: string[] = [];
    while (true) {
        result.push(printNode(node));
        if (!node.parent) {
            break;
        }
        node = node.parent;
    }
    return result.reverse().map((x, i) => {
        if (i == 0) {
            return x;
        }
        return `  ->${x}`;
    }).join('\n');
}

function rangeFromNode(node: ParserRuleContext) {
    const ret = {
        startLineNumber: (node.start?.line || -1),
        startColumn: (node.start?.column || -1) + 1,
        endLineNumber: (node.stop?.line || -1),
        endColumn: (node.stop?.column || -1) + 1,
    };
    if (node.ruleIndex === HiveSqlParser.RULE_id_) {
        ret.endColumn = ret.startColumn + (node.getText ? node.getText().length : 0);
    }
    return ret;
}

function findTokenAtPosition(
    position: Position,
    tree: ProgramContext
): ParserRuleContext | null {
    let foundNode: any = null;
    const visitor = new class extends HiveSqlParserVisitor<any> {
        visit(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visit', JSON.stringify(position), printNode(foundNode));
            }
            return super.visit(tree);
        }

        visitChildren(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visitChildren +', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitChildren(node);
        }

        visitTerminal(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                console.log('visitTerminal +', JSON.stringify(position), printNode(foundNode));
            } else {
                // console.log('visitTerminal -', JSON.stringify(position), printNode(node));
            }
            return super.visitTerminal(node);
        }

        visitErrorNode(node: any): any {
            if (isPosInParserRuleContext(position, node)) {
                foundNode = node;
                // console.log('visitErrorNode', JSON.stringify(position), printNode(foundNode));
            }
            return super.visitErrorNode(node);
        }
    };

    visitor.visit(tree);
    if (!foundNode) {
        console.warn('No node found at position:', JSON.stringify(position), 'tree:', tree);
    } else {
        console.log(
            'Found node at position:', JSON.stringify(position),
            'Node:', printNode(foundNode),
        );
    }
    return foundNode;
}

function collectTableInfo(node: ParserRuleContext | null): TableInfo[] | null {
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

                const fromKeyword = ctx.children?.[0];
                const fromVal = ctx.children?.[1] as FromSourceContext;
                if (!fromKeyword || !fromVal) {
                    return;
                }
                if (!matchType(fromKeyword as any, 'FROM')) {
                    console.warn('Unexpected token, expected FROM:', printNode(fromKeyword as any));
                    return;
                }
                if (!matchType(fromVal as any, 'fromSource')) {
                    console.warn('Unexpected token, expected FROM source:', printNode(fromVal as any));
                    return;
                }
                if (!fromVal.children || fromVal.children.length !== 1) {
                    console.warn('not expect from source');
                    return;
                }
                const joinSource = fromVal.children[0] as JoinSourceContext;
                if (!matchType(joinSource, 'joinSource') || !joinSource.children || joinSource.children.length === 0) {
                    console.warn('Unexpected token, expected JOIN source:', printNode(joinSource as any));
                    return;
                }

                console.log('collectTableInfo visitFromClause +', printChildren(joinSource as any));
                const joinItems = joinSource.children;
                for (let i = 0; i < joinItems.length; i++) {
                    const child = joinItems[i] as ParserRuleContext | TerminalNode;
                    if (matchType(child, 'atomjoinSource')) {
                        // 这里可能是个表
                        this.visitAtomjoinSource(child as AtomjoinSourceContext);
                    } 
                    if (matchType(child, 'joinSourcePart')) {
                        this.visitJoinSourcePart(child as JoinSourcePartContext);
                    }
                }
            }

            visitAtomjoinSource = (ctx: AtomjoinSourceContext) => {
            }

            visitJoinSourcePart = (ctx: JoinSourcePartContext) => {
            }
        }
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
    table_id: number;
    description: string;
    column_list: ColumnInfo[];
}

interface ColumnInfo {
    column_name: string;
    data_type_string: string;
    description: string;
}

function getTableInfoByName(
    tableName: string,
    dbName: string | undefined,
    entities: EntityContext[]
): TableInfo | null {
    if (!tableName) {
        return null;
    }
    if (dbName) {
        return tableData.find(t => t.table_name === tableName && t.db_name === dbName) || null;
    }
    const tableInfo = tableData.find(t => t.table_name === tableName);
    if (tableInfo) {
        return tableInfo;
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
        return tableData.find(t => t.table_name === parts[1] && t.db_name === parts[0]) || null;
    }
    return {
        db_name: 'local db',
        table_name: tableEntity.text,
        table_id: 0, // 这里没用
        description: '',
        column_list: []
    };
}

function getColumnInfoByName(tableInfo: TableInfo | null, columnName: string) {
    if (!tableInfo || !columnName) {
        return null;
    }
    const columnInfo = tableInfo.column_list.find(c => c.column_name === columnName);
    return columnInfo || null;
}

function penddingSliceText(slice: TextSlice, full: string): string {
    const text = slice.text;
    if (slice.startIndex > 1) {
        const before = full.slice(0, slice.startIndex).replace(/[^\n]/g, ' ');
        return before + text;
    }
    return text
}

function ruleIndexToDisplayName(node: ParserRuleContext | TerminalNode): string | undefined {
    const symbolicNames = HiveSqlParser.symbolicNames;
    if (node instanceof TerminalNode) {
        if (node.symbol.type >= 0 && node.symbol.type < symbolicNames.length) {
            return symbolicNames[node.symbol.type] || `Unknown Symbol: ${node.symbol.type}`;
        }
        return node.getText();
    }
    const ruleNames = HiveSqlParser.ruleNames;
    const ruleIndex = node.ruleIndex;

    if (ruleIndex >= 0 && ruleIndex < ruleNames.length) {
        if (!ruleNames[ruleIndex]) {
            return `Unknown Rule: ${ruleIndex}`;
        }
        return ruleNames[ruleIndex];
    }
    return node.getText();
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

function matchType(node: ParserRuleContext | TerminalNode, ruleIndex: number | string): boolean {
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
    
    return node.ruleIndex === ruleIndex;
}

// from buttom to top
function matchSubTree(node: ParserRuleContext, ruleIndex: number[] | string[]): ParserRuleContext | null {
    const checkedRuleIndex = ruleIndex.slice(0);
    if (!matchType(node, checkedRuleIndex[0])) {
        return null;
    }
    let parent = node.parent;
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
                const text = penddingSliceText(slice, document.getText());
                console.log('getCtxFromPos text', '-->' + text + '<--');
                const ctx = hiveSqlParse.createParser(document.getText());
                const tree = ctx.program();
                const foundNode = findTokenAtPosition(position, tree);
                return foundNode;
            }
        }
        return null;
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
        ) => {
            const foundNode = getCtxFromPos(position);
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

            const parent = foundNode.parent!;
            const ext: string[] = [];
            ext.push((position as any).text)
            ext.push(printNodeTree(foundNode));
            const syntaxSuggestions = hiveSqlParse.getSuggestionAtCaretPosition(document.getText(), position)?.syntax;
            const entities = hiveSqlParse.getAllEntities(document.getText(), position) || [];
            const currentEntities = entities.filter(e => e.belongStmt.isContainCaret);
            const currentTableEntities = currentEntities.filter(e => e.entityContextType === EntityContextType.TABLE);

            console.log('do hover syntaxSuggestions', printNode(parent), position, syntaxSuggestions, currentEntities);

            if (parent.ruleIndex === HiveSqlParser.RULE_tableSource) {
                const tableIdExp = parent.children![0].getText();
                const tableInfo = getTableInfoByName(tableIdExp, undefined, currentTableEntities);
                if (!tableInfo) {
                    return noTableInfoRes(tableIdExp, rangeFromNode(foundNode), ext);
                }
                const range = rangeFromNode(foundNode);
                return tableRes(tableInfo, range, ext);
            }
            if (
                matchSubTree(foundNode, ['id_', 'tableName'])
                || matchSubTree(foundNode, ['DOT', 'tableName'])
            ) {
                const dbName = parent.children?.length === 3 ? parent.children![0].getText() : undefined;
                const tableName = parent.children?.length === 3 ? parent.children![2].getText() : parent.children![0].getText();

                const tableInfo = getTableInfoByName(tableName, dbName, currentTableEntities);
                ext.push(`do hover tableName ${printNode(parent)}, 'tableIdExp', ${tableName}, 'tableInfo', ${JSON.stringify(tableInfo)}`);
                if (!tableInfo) {
                    if (
                        matchSubTree(foundNode, ['id_', 'tableName', 'tableOrView', 'tableSource'])
                        || matchSubTree(foundNode, ['DOT', 'tableName', 'tableOrView', 'tableSource'])
                    ) {
                        // to found cte source
                        const cteTables = entities.filter(e => e.entityContextType === EntityContextType.TABLE);
                        const cteTable = cteTables.find(e => e.text === tableName);
                        if (cteTable) {
                            return tableRes({
                                db_name: '',
                                table_name: cteTable.text,
                                table_id: 0,
                                description: 'cte table',
                                column_list: [] // 这咋整
                            }, rangeFromNode(foundNode), ext);
                        }
                        return unknownRes(tableName, rangeFromNode(foundNode), ext);
                    }
                    return noTableInfoRes(tableName, rangeFromNode(foundNode), ext);
                }
                const range = rangeFromNode(foundNode);
                return tableRes(tableInfo, range, ext);
            }
            if (parent.ruleIndex === HiveSqlParser.RULE_viewName) {
                return unknownRes(foundNode.getText(), rangeFromNode(foundNode), ext);
            }

            // columnName -> poolPath -> id_(from default table name)
            // columnName -> poolPath -> id_(table name or alias), ., _id
            if (
                matchSubTree(foundNode, ['id_', 'poolPath', 'columnName'])
                || matchSubTree(foundNode, ['id_', 'poolPath', 'columnNamePath'])
                || matchSubTree(foundNode, ['DOT', 'poolPath', 'columnNamePath'])
            ) {
                const tableIdExp = parent.children?.length === 1 ? undefined : parent.children![0].getText();
                const columnName = parent.children?.length === 1 ? parent.children![0].getText() : parent.children![2].getText();
                const range = rangeFromNode(foundNode);

                if (!tableIdExp) {
                    const tableInfo = getTableInfoByName(currentEntities[0].text, undefined, currentTableEntities);
                    if (!tableInfo) {
                        return noTableInfoRes(currentEntities[0].text, range, ext);
                    }
                    const columnInfo = getColumnInfoByName(tableInfo, columnName);
                    if (!columnInfo) {
                        return noColumnInfoRes(tableInfo, columnName, range, ext);
                    }
                    return tableAndColumn(tableInfo, columnInfo, range, ext);
                }

                const selectStmt = matchSubTree(foundNode, ['id_', '*', 'atomSelectStatement']);
                ext.push(`do hover selectStmt ${printNode(selectStmt)}`);
                const extTableInfo = collectTableInfo(selectStmt);

                const tableInfo = getTableInfoByName(tableIdExp, undefined, currentTableEntities);
                if (!tableInfo) {
                    return noTableInfoRes(tableIdExp, range, ext);
                }
                const columnInfo = getColumnInfoByName(tableInfo, columnName);
                if (!columnInfo) {
                    return noColumnInfoRes(tableInfo, columnName, range, ext);
                }
                return tableAndColumn(tableInfo, columnInfo, range, ext);
            }

            if (matchSubTree(foundNode, ['id_', 'selectItem'])) {
                if (foundNode === parent.children?.[2]
                    && isKeyWord(parent.children[1]!, 'as')
                ) {
                    return createColumnRes(foundNode, rangeFromNode(foundNode), ext);
                }
                return unknownRes(foundNode.getText(), rangeFromNode(foundNode), ext);
            }

            if (matchSubTree(foundNode, ['id_', 'subQuerySource'])) {
                ext.push(`entities ${JSON.stringify(entities)}`)
                ext.push(`currentEntities${JSON.stringify(currentEntities)}`);
                return unknownRes(foundNode.getText(), rangeFromNode(foundNode), ext);
            }

            return unknownRes(foundNode.getText(), rangeFromNode(foundNode), ext);
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
        }
    };
}
