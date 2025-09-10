import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { AtomSelectStatementContext, ExpressionContext, QueryStatementExpressionContext, TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { uuidv4 } from "./util";
import { IdentifierScope } from "./identifier_scope";
import { getColumnInfoFromNode, getColumnsFromRollupOldSyntax, getFunctionCallFromExpression, getOnConditionOfFromClause, isPosInParserRuleContext, isSameColumnInfo } from "./helpers/table_and_column";
import { ColumnInfo, TableSource } from "./types";
    

export class MapReduceScope {
    id = uuidv4();

    inputTable: Map<string, TableSource> = new Map();
    inputTables: TableSource[] = [];

    exportColumns: ColumnInfo[] = [];

    defaultInputTable: ParserRuleContext | null = null;

    tableReferences: Map<string, ParserRuleContext[]> = new Map();

    constructor(
        public context: QueryStatementExpressionContext | AtomSelectStatementContext,
        public identifierScope: IdentifierScope
    ) {
        
    }

    setDefaultInputTable(name: string, table: ParserRuleContext) {
        this.defaultInputTable = table;
    }

    addInputTable(name: string, table: ParserRuleContext, defineReference: ParserRuleContext) {
        const tableInfo = {
            tableName: name,
            reference: table,
            defineReference
        };
        if (!this.inputTable.has(name)) {
            this.inputTable.set(name, tableInfo);
        }
        this.inputTables.push(tableInfo);
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
            type: string
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
                    type: 'duplicate_column'
                });
            }
            columnNames.add(column.exportColumnName);

            if (!column.referanceTableName && hasMultiInputTable) {
                errors.push({
                    message: `In multi-input select, export column '${column.exportColumnName}' must specify the referance table name`,
                    context: column.reference,
                    level: 'error',
                    type: 'no_table_ref'
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
                    type: 'duplicate_table'
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
                    const functionCall = getFunctionCallFromExpression(column.reference);
                    if (functionCall) {
                        return;
                    }
                }
                if (!groupByColumns.some(groupByColumn => isSameColumnInfo(groupByColumn, column))) {
                    // check if same column define
                    errors.push({
                        message: `Export column '${column.exportColumnName}' is not included in the group-by columns`,
                        context: column.reference,
                        level: 'warning',
                        type: 'group_by'
                    });
                }
            });
        }

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

    getTableByName(name: string): ParserRuleContext | undefined {
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
        return this.exportColumns.find(column => column.referanceTableName === tableName && column.referanceColumnName === columnName) || null;
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
        const references = this.tableReferences.get(name);
        if (references) {
            return references;
        }
        return [];
    }

    getParentMrScope() {
        return this.identifierScope?.parent?.getMrScope() || null;
    }
    
}