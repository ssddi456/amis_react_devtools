import { ParserRuleContext } from "antlr4ng";
import { uuidv4 } from "./util";
import { IdentifierScope } from "./Identifier_scope";
import { AtomSelectStatementContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { type Position } from "monaco-editor";
import { isPosInParserRuleContext } from "./sql_ls_helper";
    
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
        public context: AtomSelectStatementContext,
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
            context: ParserRuleContext;
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

        return errors;
    }

    getScopeByPosition(position: Position): MapReduceScope | null {
        const context = this.context;
        const selectClause = context.selectClause();
        if (selectClause && isPosInParserRuleContext(position, selectClause)) {
            // input
            return this;
        }
        const fromClause = context.fromClause();
        if (fromClause && isPosInParserRuleContext(position, fromClause)) {
            // input
            return this.identifierScope.parent!.getMrScope();
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
        return null;
    }

    getTableByName(name: string): ParserRuleContext | undefined {
        return this.identifierScope.getReferencesByName(name)[0];
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
}