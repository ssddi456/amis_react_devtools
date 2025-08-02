import type { Position } from 'monaco-editor';

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

// Converts a string to a ls test case
// for example:
// ```
// select * from table where id = 1
//               ^
// ```
// will be converted to
// ```
// {
//    text: 'select * from table where id = 1',
//    positions: [{ lineNumber: 1, column: 15 }]
// }
// ```
export interface LsTestCase {
    model: {
        uri: { toString: () => string; };
        getValue: () => string;
    };
    positions: Position[];
}

const regPositionLine = /^((\s*)(\^))+$/;

const validate = false;

export function caseFromString(str: string): LsTestCase {
    const lines = str.split('\n');
    const text = lines.map(line => line.trimRight());
    const realLines: string[] = [];
    const positions: Position[] = [];
    let lineNumber = 0;
    for (let i = 0; i < text.length; i++) {
        const line = text[i];
        const match = line.match(regPositionLine);
        if (match) {
            let lastColumnIndex = 0
            while (true) {
                const column = line.indexOf('^', lastColumnIndex);
                if (column === -1) {
                    break;
                }
                lastColumnIndex = column + 1;
                positions.push({
                    lineNumber,
                    column: lastColumnIndex,
                    text: realLines[lineNumber - 1].slice(0, lastColumnIndex),
                } as any as Position);
            }
        } else {
            realLines.push(line);
            lineNumber ++;
        }
    }

    if (validate) {
        
        for (const pos of positions) {
            const line = realLines[pos.lineNumber - 1];
            if (pos.column > line.length) {
                throw new Error(`Position ${pos.lineNumber}:${pos.column} is out of range in line: ${line}`);
            }
            const text = line.slice(0, pos.column);
            if (text !== (pos as any).text) {
                throw new Error(`Position text mismatch at ${pos.lineNumber}:${pos.column}, expected: "${text}", got: "${(pos as any).text}"`);
            }
        }
    }



    return { model: createModel(realLines.join('\n')), positions };
}

export function createModel(text: string) {
    return {
        uri: { toString: () => 'test://uri/0' },
        getValue: () => text,
    };
}

export type WithSource<T> = T & {
    __source?: {
        fileName: string;
        lineNumber: number;
        columnNumber: number;
    };
};