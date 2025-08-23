import { ParserRuleContext } from "antlr4ng";
import { uuidv4 } from "./util";
import { IdentifierScope } from "./Identifier_scope";

interface TableSource {
    tableName: string;
    reference: ParserRuleContext,
}

interface ColumnInfo {
    exportColumnName: string;
    referanceTableName: string;
    referanceColumnName: string;
    reference: ParserRuleContext;
}

export class MapReduceScope {
    id = uuidv4();

    inputTable: Map<string, TableSource> = new Map();

    exportColumns: ColumnInfo[] = [];

    groupByColumns: ColumnInfo[] = [];

    defaultInputTable: ParserRuleContext | null = null;

    constructor(
        public context: ParserRuleContext,
        public identifierScope: IdentifierScope
    ) {
        
    }

    setDefaultInputTable(name: string, table: ParserRuleContext) {
        this.defaultInputTable = table;
    }

    addInputTable(name: string, table: ParserRuleContext) {
        this.inputTable.set(name, {
            tableName: name,
            reference: table
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

    addGroupByColumn(column: ColumnInfo) {
        this.groupByColumns.push(column);
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
}