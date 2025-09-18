import React from "react";


export function SourceLink({ source }: { source: { fileName: string; lineNumber: number; columnNumber: number } | undefined }) {
    if (!source) {
        return null;
    }

    return (
        <a
            style={{ fontSize: '12px', color: '#666', paddingLeft: 8 }}
            href={`vscode://file/${source.fileName}:${source.lineNumber}:${source.columnNumber}`}
            target="_blank"
            rel="noopener noreferrer"
        >
            Source
        </a>
    );
}
