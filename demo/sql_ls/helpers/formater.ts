import { ParseTree } from 'antlr4ng';
import { formatHiveSQL } from '../formatter';

export function sqlStringFromNode(ctx: ParseTree | null): string {
    if (!ctx) {
        return '';
    }
    if (ctx.getChildCount() === 0) {
        return ctx.getText();
    }
    let result = '';
    for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        result += sqlStringFromNode(child);
        if (i !== ctx.getChildCount() - 1) {
            result += ' ';
        }
    }
    return result;
}

export function getFormattedSqlFromNode(ctx: ParseTree): string {
    const sql = sqlStringFromNode(ctx);
    return formatHiveSQL(sql);
}
