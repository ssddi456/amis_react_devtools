import * as vscode from 'vscode';
import { Pos, Range } from "@amis-devtools/sql-language-service/src/helpers/pos";

export function positionToPos(position: vscode.Position): Pos {
    return {
        lineNumber: position.line + 1,
        column: position.character + 1
    };
}

export function rangeToPosRange(range: vscode.Range): Range {
    return {
        startLineNumber: range.start.line + 1,
        startColumn: range.start.character + 1,
        endLineNumber: range.end.line + 1,
        endColumn: range.end.character + 1
    }
}

export function posToPosition(pos: Pos): vscode.Position {
    return new vscode.Position(pos.lineNumber - 1, pos.column - 1);
}

export function posRangeToRange(range: Range): vscode.Range {
    return new vscode.Range(
        new vscode.Position(range.startLineNumber - 1, range.startColumn - 1),
        new vscode.Position(range.endLineNumber - 1, range.endColumn - 1)
    );
}