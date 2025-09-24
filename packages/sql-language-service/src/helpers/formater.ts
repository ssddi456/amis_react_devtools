import { ParseTree } from 'antlr4ng';
import { formatHiveSQL } from '../formatter';
import { SubQuerySourceContext } from 'dt-sql-parser/dist/lib/hive/HiveSqlParser';
import { matchSubPath, matchSubPathOneOf } from './tree_query';
import { subqueryPlaceHolder } from '../consts';


interface GenerateSqlOptions {
    hideSubQuery?: boolean;
}

export function sqlStringFromNode(ctx: ParseTree | null, options: GenerateSqlOptions = {}): string {
    if (!ctx) {
        return '';
    }
    if (ctx.getChildCount() === 0) {
        return ctx.getText();
    }
    let result = '';
    for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        if (child && options.hideSubQuery && ctx instanceof SubQuerySourceContext) {
            debugger;
        }
        if (
            child && 
            options.hideSubQuery &&
            matchSubPathOneOf(child, [
                ['queryStatementExpression', 'subQuerySource'],
                ['selectStatement', 'subQueryExpression']
            ])
        )  {
            result += subqueryPlaceHolder;
        } else {
            result += sqlStringFromNode(child, options);
        }
        if (i !== ctx.getChildCount() - 1) {
            result += ' ';
        }
    }
    return result;
}

export function getFormattedSqlFromNode(ctx: ParseTree, options: GenerateSqlOptions = {}): string {
    const sql = sqlStringFromNode(ctx, options);
    return formatHiveSQL(sql);
}
