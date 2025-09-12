import { ParserRuleContext } from "antlr4ng";
import { TableNameContext, TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { getTableNameFromContext } from "./table_and_column";
import { matchSubPath, matchSubPathOneOf } from "./tree_query";
import { IdentifierScope } from "../identifier_scope";
import { MapReduceScope } from "../mr_scope";


export const getIdentifierReferences = (
    foundNode: ParserRuleContext,
    mrScope: MapReduceScope | null | undefined,
    context: IdentifierScope
): ParserRuleContext[] | undefined => {
    const tableNameRef = matchSubPath(foundNode, ['id_', 'tableName']) as TableNameContext | null;
    if (tableNameRef) {
        const references: ParserRuleContext[] = [];
        const tableSource = matchSubPath(tableNameRef, ['*', 'tableSource']) as TableSourceContext | null;
        const tableId = getTableNameFromContext(tableNameRef).tableId;
        if (!tableSource?._alias) {
            console.log('getIdentifierReferences tableId', tableId);
            const shortCutRef = tableId ? context.getMrScope()?.getTableReferencesByName(tableId) : undefined;
            references.push(...(shortCutRef || []));
        }

        const parentRef = tableId ? mrScope?.getTableReferencesByName(tableId) : undefined;
        references.push(...(parentRef || []));

        return references;
    }

    const tableRef = matchSubPathOneOf(foundNode, [
        ['id_', 'subQuerySource'],
        ['id_', 'virtualTableSource'],
        ['id_', 'cteStatement'],
    ]);

    if (tableRef) {
        const references: ParserRuleContext[] = [];
        const tableId = foundNode.getText();
        console.log('getIdentifierReferences tableId', tableId);
        const parentRef = tableId ? mrScope?.getTableReferencesByName(tableId) : undefined;
        references.push(...(parentRef || []));
        return references;
    }

    const foundTableSource = matchSubPathOneOf(foundNode, [
        ['id_', 'tableSource'],
        ['id_', 'poolPath', 'columnName'],
        ['id_', 'poolPath', 'columnNamePath'],
    ]) as ParserRuleContext | null;

    if (foundTableSource) {
        let tableId: string | undefined;
        if (foundTableSource instanceof TableSourceContext) {
            tableId = foundNode.getText();
        } else {
            tableId = getTableNameFromContext(foundTableSource).tableId;
        }
        console.log('getIdentifierReferences tableId', tableId);
        const references = tableId ? mrScope?.getTableReferencesByName(tableId) : undefined;
        return references;
    }
};
