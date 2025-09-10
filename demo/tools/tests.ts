import type { Position } from 'monaco-sql-languages/esm/fillers/monaco-editor-core';

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
            let lastColumnIndex = 0;
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
            lineNumber++;
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
function createModel(text: string) {
    return {
        uri: { toString: () => 'test://uri/0' },
        getValue: () => text,
    };
}
