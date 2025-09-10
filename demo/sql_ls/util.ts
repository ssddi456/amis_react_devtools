export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function posInRange(pos: { lineNumber: number; column: number; }, range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; }) {
    return pos.lineNumber >= range.startLineNumber &&
        pos.lineNumber <= range.endLineNumber &&
        (pos.lineNumber > range.startLineNumber || pos.column >= range.startColumn) &&
        (pos.lineNumber < range.endLineNumber || pos.column <= range.endColumn);
}

export type WithSource<T> = T & {
    __source?: {
        fileName: string;
        lineNumber: number;
        columnNumber: number;
    };
};
