import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { AtomSelectStatementContext, ExpressionContext, QueryStatementExpressionContext, TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { uuidv4 } from "./helpers/util";
import { IdentifierScope } from "./identifier_scope";
import { getAtomExpressionFromExpression, getColumnInfoFromNode, getColumnsFromRollupOldSyntax, getOnConditionOfFromClause, isSameColumnInfo } from "./helpers/table_and_column";
import { isPosInParserRuleContext } from "./helpers/pos";
import { ColumnInfo, tableReferenceContext, TableSource } from "./types";
import { logSource, printNodeTree } from "./helpers/log";
import { matchSubPath } from "./helpers/tree_query";
import { sqlStringFromNode } from "./helpers/formater";
import { ErrorType } from "./consts";
    

export class MapReduceScope {
    id = uuidv4();

    inputTable: Map<string, TableSource> = new Map();
    inputTables: TableSource[] = [];

    tableDefinitions: Map<string, TableSource> = new Map();
    tableDefinitionList: TableSource[] = [];

    exportColumns: ColumnInfo[] = [];

    defaultInputTable: ParserRuleContext | null = null;

    tableReferences: Map<string, ParserRuleContext[]> = new Map();

    constructor(
        public context: QueryStatementExpressionContext | AtomSelectStatementContext,
        public identifierScope: IdentifierScope,
        public mrOrder: number,
    ) {
        
    }

    setDefaultInputTable(name: string, table: ParserRuleContext) {
        this.defaultInputTable = table;
    }

    addInputTable(name: string, table: tableReferenceContext, defineReference: ParserRuleContext) {
        const tableInfo: TableSource = {
            tableName: name,
            reference: table,
            defineReference
        };
        if (!this.inputTable.has(name)) {
            this.inputTable.set(name, tableInfo);
        }
        this.inputTables.push(tableInfo);
    }

    addTableDefinition(name: string, table: tableReferenceContext, defineReference: ParserRuleContext) {
        const tableInfo: TableSource = {
            tableName: name,
            reference: table,
            defineReference
        };
        if (!this.tableDefinitions.has(name)) {
            this.tableDefinitions.set(name, tableInfo);
        }
        this.tableDefinitionList.push(tableInfo);
    }

    getDefaultInputTableName() {
        for (let [name, table] of this.inputTable) {
            if (table.reference === this.defaultInputTable) {
                return name;
            }
        }
        return '';
    }

    addExportColumn(column: ColumnInfo) {
        this.exportColumns.push(column);
    }

    validate() {
        const errors: {
            message: string;
            context: ParserRuleContext | TerminalNode;
            level: 'error' | 'warning';
            type: ErrorType
        }[] = [];

        const hasMultiInputTable = this.inputTables.length > 1;
        // check exportColumns name duplicate
        const columnNames = new Set<string>();
        this.exportColumns.forEach(column => {
            if (columnNames.has(column.exportColumnName)) {
                errors.push({
                    message: `Duplicate export column name '${column.exportColumnName}'`,
                    context: column.reference,
                    level: 'error',
                    type: ErrorType.DuplicateColumn
                });
            }
            columnNames.add(column.exportColumnName);

            if (!column.referenceTableName && hasMultiInputTable) {
                errors.push({
                    message: `In multi-input select, export column '${column.exportColumnName}' must specify the referance table name`,
                    context: column.reference,
                    level: 'error',
                    type: ErrorType.MustSpecificTable
                });
            }
        });
        // check input table alias duplicate
        const tableNames = new Set<string>();
        this.inputTables.forEach(table => {
            if (tableNames.has(table.tableName)) {
                errors.push({
                    message: `Duplicate input table alias '${table.tableName}'`,
                    context: table.reference,
                    level: 'error',
                    type: ErrorType.DuplicateTable
                });
            }
            tableNames.add(table.tableName);
        });

        // get group by columns
        // check if directly export columns is in the group-by columns
        const groupByColumns = this.getGroupByColumns();
        if (groupByColumns.length) {
            this.exportColumns.forEach(column => {
                if (column.reference instanceof ExpressionContext) {
                    const atom = getAtomExpressionFromExpression(column.reference);
                    if (atom?.function_()
                        || atom?.constant() 
                        || atom?.intervalExpression()
                    ) {
                        return;
                    }
                }
                // TODO: better export column reference dependances check
                if (!groupByColumns.some(groupByColumn => isSameColumnInfo(groupByColumn, column))) {
                    // check if same column define
                    errors.push({
                        message: `Export column '${column.referenceColumnName}' is not included in the group-by columns`,
                        context: column.reference,
                        level: 'warning',
                        type: ErrorType.ColumnNotInGroupBy
                    });
                }
            });
        }

        // check orphan ctes
        this.tableDefinitions.forEach((tableDef, name) => {
            const referenced = this.getTableReferencesByName(name);
            if (referenced.some((ctx) => {
                const isCteId = matchSubPath(ctx, ['id_', 'cteStatement']) != null;
                if (!isCteId) {
                    logSource({
                        type: 'debug',
                        message: `orphan cte check: referenced ${name} from ${printNodeTree(ctx)} is not cte id: ${isCteId} ${sqlStringFromNode(ctx)}`,
                    });
                }
                return matchSubPath(ctx, ['id_', 'cteStatement']) == null;
            })) {
                return;
            }

            errors.push({
                message: `Table definition '${name}' is not referenced`,
                context: tableDef.defineReference,
                level: 'warning',
                type: ErrorType.OrphanTableDef
            });
        });

        return errors;
    }

    getScopeByPosition(position: { lineNumber: number, column: number }): MapReduceScope | null {
        const context = this.context;
        if (context instanceof QueryStatementExpressionContext) {
            return this;
        }

        if (context instanceof AtomSelectStatementContext) {
            const selectClause = context.selectClause();
            if (selectClause && isPosInParserRuleContext(position, selectClause)) {
                // input
                return this;
            }
            const fromClause = context.fromClause();
            if (fromClause && isPosInParserRuleContext(position, fromClause)) {
                const tableView = fromClause.fromSource().joinSource()?.atomjoinSource().tableSource()?.tableOrView();
                if (tableView) {
                    if (isPosInParserRuleContext(position, tableView)) {
                        // input
                        return this.getParentMrScope();
                    }
                }
                // if in on expression
                const conditions = getOnConditionOfFromClause(fromClause);
                if (conditions) {
                    for (let index = 0; index < conditions.length; index++) {
                        const cond = conditions[index];
                        if (isPosInParserRuleContext(position, cond)) {
                            // input
                            // should create a sub mr scope;
                            return this;
                        }
                    }
                }

                // console.log('pos not in conditions', (position as any)?.context?.getText(), );
                // console.log('pos not in conditions', position, );
                // console.log('pos not in conditions', fromClause, );
                
                // input
                return this;
            }
            const whereClause = context.whereClause();
            if (whereClause && isPosInParserRuleContext(position, whereClause)) {
                // input
                return this;
            }
            const groupByClause = context.groupByClause();
            if (groupByClause && isPosInParserRuleContext(position, groupByClause)) {
                // input
                return this;
            }
            const havingClause = context.havingClause();
            if (havingClause && isPosInParserRuleContext(position, havingClause)) {
                // input
                return this;
            }
            const qualifyClause = context.qualifyClause();
            if (qualifyClause && isPosInParserRuleContext(position, qualifyClause)) {
                // input
                return this;
            }
        }
        return null;
    }

    getTableScopeByName(name: string): MapReduceScope | undefined {
        const tableInfo = this.inputTable.get(name);
        if (tableInfo) {
            return this;
        }
        const tableDef = this.tableDefinitions.get(name);
        if (tableDef) {
            return this;
        }
        const parentMrScope = this.getParentMrScope();
        if (parentMrScope) {
            return parentMrScope.getTableScopeByName(name);
        }
        return undefined;
    }

    /**
     * get table defined in sql, like cte or sub query or virtual table by name.
     * will not get table defined in outside scope.
     */
    getTableByName(name: string): tableReferenceContext | undefined {
        const tableInfo = this.inputTable.get(name);
        const reference = tableInfo?.reference;
        if (reference) {
            if (reference instanceof TableSourceContext) {
                const tableName = reference.tableOrView().getText();
                const parentMrScope = this.getParentMrScope();
                const parentRef = parentMrScope?.getTableByName(tableName);
                if (parentRef) {
                    return parentRef;
                }
            }
        }
        const tableDef = this.tableDefinitions.get(name);
        if (tableDef) {
            return tableDef.reference;
        }
        return reference;
    }

    getColumnByName(tableName: string | null, columnName: string): ColumnInfo | null {
        if (!tableName) {
            return null;
        }
        const table = this.getTableByName(tableName);
        if (!table) {
            return null;
        }
        return this.exportColumns.find(column => column.referenceTableName === tableName && column.referenceColumnName === columnName) || null;
    }

    getGroupByColumns() {
        const ret: ColumnInfo[] = [];
        const context = this.context;
        if (context instanceof AtomSelectStatementContext) {
            const groupByClause = context.groupByClause();
            const columnName = groupByClause?.columnName();
            if (columnName) {
                const columnInfo = getColumnInfoFromNode(columnName);
                ret.push(columnInfo);
            }
            const columnNames = groupByClause?.rollupOldSyntax();
            if (columnNames) {
                // get all
                ret.push(...getColumnsFromRollupOldSyntax(columnNames));
            }
        }
        return ret;
    }

    addTableReference(name: string, reference: ParserRuleContext) {
        if (!this.tableReferences.has(name)) {
            this.tableReferences.set(name, []);
        }
        this.tableReferences.get(name)!.push(reference);
    }


    getTableReferencesByName(name: string): ParserRuleContext[] {
        const references:ParserRuleContext[] = [...this.tableReferences.get(name)||[]];

        return references;
    }

    getParentMrScope() {
        return this.identifierScope?.parent?.getMrScope() || null;
    }

    getChildScopes(): MapReduceScope[] {
        const scopes: MapReduceScope[] = [];
        const identifierScopes = [...this.identifierScope.children];
        while (identifierScopes.length) {
            const identifierScope = identifierScopes.shift()!;
            if (identifierScope.mrScope && identifierScope.mrScope !== this) {
                scopes.push(identifierScope.mrScope);
            } else {
                identifierScopes.push(...identifierScope.children);
            }
        }
        return scopes;
    }

    walkScopes(fn: (scope: MapReduceScope) => boolean | void) {
        const goDeep = fn(this);
        if (goDeep === false) {
            return;
        }
        const children = this.getChildScopes();
        children.forEach(child => child.walkScopes(fn));
    }

}