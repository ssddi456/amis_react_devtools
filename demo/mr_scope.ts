import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { uuidv4 } from "./util";
import { IdentifierScope } from "./Identifier_scope";
import { AtomSelectStatementContext, HiveSqlParser, QueryStatementExpressionContext, TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { getOnConditionOfFromClause, isPosInParserRuleContext } from "./sql_ls_helper";
    
interface TableSource {
    tableName: string;
    reference: ParserRuleContext,
    defineReference: ParserRuleContext
}

interface ColumnInfo {
    exportColumnName: string;
    referanceTableName: string;
    referanceColumnName: string;
    reference: ParserRuleContext;
    defineReference: ParserRuleContext;
}

export class MapReduceScope {
    id = uuidv4();

    inputTable: Map<string, TableSource> = new Map();

    exportColumns: ColumnInfo[] = [];

    defaultInputTable: ParserRuleContext | null = null;

    constructor(
        public context: QueryStatementExpressionContext | AtomSelectStatementContext,
        public identifierScope: IdentifierScope
    ) {
        
    }

    setDefaultInputTable(name: string, table: ParserRuleContext) {
        this.defaultInputTable = table;
    }

    addInputTable(name: string, table: ParserRuleContext, defineReference: ParserRuleContext) {
        this.inputTable.set(name, {
            tableName: name,
            reference: table,
            defineReference,
        });
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
        }[] = [];

        this.exportColumns.forEach(column => {
            if (!column.exportColumnName) {
                errors.push({
                    message: 'Export column name is missing',
                    context: column.reference,
                    level: 'error'
                });
            }
        });
        // check exportColumns name duplicate
        const columnNames = new Set<string>();
        this.exportColumns.forEach(column => {
            if (columnNames.has(column.exportColumnName)) {
                errors.push({
                    message: `Duplicate export column name '${column.exportColumnName}'`,
                    context: column.reference,
                    level: 'error'
                });
            }
            columnNames.add(column.exportColumnName);
        });
        // check input table alias duplicate
        const tableNames = new Set<string>();
        this.inputTable.forEach(table => {
            if (tableNames.has(table.tableName)) {
                errors.push({
                    message: `Duplicate input table alias '${table.tableName}'`,
                    context: table.reference,
                    level: 'error'
                });
            }
            tableNames.add(table.tableName);
        });

        // get group by columns
        // check if directly export columns is in the group-by columns
        const groupByColumns = this.getGroupByColumns();
        this.exportColumns.forEach(column => {
            if (!groupByColumns.includes(column.referanceColumnName)) {
                errors.push({
                    message: `Export column '${column.exportColumnName}' is included in the group-by columns`,
                    context: column.reference,
                    level: 'warning'
                });
            }
        });

        // using is not allowed
        this.context.getTokens(HiveSqlParser.KW_USING).forEach(token => {
            errors.push({
                message: `Using 'USING' operator is not allowed`,
                context: token,
                level: 'error'
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
        const ret: string[] = [];
        return ret;
    }

    getParentMrScope() {
        return this.identifierScope?.parent?.getMrScope() || null;
    }
    
}