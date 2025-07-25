import { Position } from 'monaco-editor';

export function posToPosition(position: {
    lineNumber: number;
    column: number;
}) {
    return {
        line: position.lineNumber - 1,
        character: position.column - 1
    };
}

export function toRange(position: {
    start: {
        line: number;
        character: number;
    };
    end: {
        line: number;
        character: number;
    };
}) {
    return {
        startLineNumber: position.start.line + 1,
        startColumn: position.start.character + 1,
        endLineNumber: position.end.line + 1,
        endColumn: position.end.character + 1
    };
}

export function posInRange(pos: { lineNumber: number; column: number; }, range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; }) {
    return pos.lineNumber >= range.startLineNumber &&
        pos.lineNumber <= range.endLineNumber &&
        (pos.lineNumber > range.startLineNumber || pos.column >= range.startColumn) &&
        (pos.lineNumber < range.endLineNumber || pos.column <= range.endColumn);
}

export function posFromString(str: string): Position {
    const parts = str.split(':');
    if (parts.length === 2) {
        return {
            lineNumber: parseInt(parts[0], 10),
            column: parseInt(parts[1], 10)
        } as Position;
    }
    return { lineNumber: 0, column: 0 } as Position;
}

export function stringFromPos(pos: Position): string {
    return `${pos.lineNumber}:${pos.column}`;
}