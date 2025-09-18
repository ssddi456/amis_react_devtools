import { ParserRuleContext } from "antlr4ng";
import { tableReferenceContext } from "../types";
import { CteStatementContext, VirtualTableSourceContext, SubQuerySourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { TableSourceContext } from "dt-sql-parser/dist/lib/mysql/MySqlParser";

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


export type WithSource<T> = T & {
    __source?: {
        fileName: string;
        lineNumber: number;
        columnNumber: number;
    };
};

export function isTableReferenceContext(ctx: ParserRuleContext): ctx is tableReferenceContext {
    if (ctx instanceof TableSourceContext
        || ctx instanceof CteStatementContext
        || ctx instanceof VirtualTableSourceContext
        || ctx instanceof SubQuerySourceContext
    ) {
        return true;
    }
    return false;
}


export const debounce = (func: (...args: any[]) => void, wait: number) => {
    let timeout: ReturnType<typeof setTimeout> | null;
    return (...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
};

export const once = <T extends (...args: any[]) => any>(fn: T): T => {
    let called = false;
    let result: any;
    return function (...args: any[]) {
        if (!called) {
            called = true;
            result = fn(...args);
        }
        return result;
    } as T;
}