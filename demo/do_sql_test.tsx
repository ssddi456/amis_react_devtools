import { useState } from "react";
import { LsTestCase } from "./ls_helper";
import { createHiveLs } from "./sql_ls";


// 创建高亮文本的辅助函数
export function createHighlightedText(text: string, positions: Array<{ lineNumber: number; column: number }>) {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line, lineIndex) => {
        const lineNumber = lineIndex + 1;
        const linePositions = positions.filter(pos => pos.lineNumber === lineNumber);

        if (linePositions.length === 0) {
            return line;
        }

        // 按列位置排序，从后向前处理以避免索引偏移
        const sortedPositions = linePositions.sort((a, b) => b.column - a.column);
        let result = line;

        sortedPositions.forEach(pos => {
            const index = pos.column - 1; // 转换为0索引
            if (index >= 0 && index < result.length) {
                const char = result[index];
                const positionIndex = positions.indexOf(pos);
                result = result.slice(0, index) +
                    `<span style="background-color: yellow; font-weight: bold; color: red; position: relative;">${char}<sup style="color: blue; font-size: 10px; font-weight: bold;">${positionIndex + 1}</sup></span>` +
                    result.slice(index + 1);
            }
        });

        return result;
    });

    return highlightedLines.join('\n');
}


export function DoSqlTest({ case: testCase }: { case: LsTestCase; }) {
    const [results, _] = useState(() => {
        const model = testCase.model;
        const positions = testCase.positions;
        const hoverResults = positions.map(pos => {
            const resInfo = createHiveLs(model).doHover(pos);
            return resInfo;
        });
        return { model, positions, hoverResults };
    });

    const highlightedText = createHighlightedText(testCase.model.getValue(), testCase.positions);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '8px',
                padding: 8,
                backgroundColor: '#f5f5f5',
                position: 'relative',
            }}
        >
            <div
                style={{
                    flex: 1,
                    maxWidth: 'calc(50% - 5px)',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    position: 'sticky',
                    top: 0,
                    fontFamily: 'monospace',
                }}
                dangerouslySetInnerHTML={{ __html: highlightedText }} />
            <div
                style={{
                    flex: 1,
                    maxWidth: 'calc(50% - 5px)'
                }}
            >
                {results.hoverResults.map((res, index) => {
                    const positionStr = `(${results.positions[index].lineNumber}:${results.positions[index].column})`;
                    if (res) {
                        const rangeStr = `(${res.range?.startLineNumber}:${res.range?.startColumn} -> ${res.range?.endLineNumber}:${res.range?.endColumn})`;
                        return (
                            <div key={index}>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#333',
                                        fontWeight: 'bolder'
                                    }}
                                >Hover Result {index + 1}
                                    &nbsp;
                                    pos: {positionStr}
                                    &nbsp;
                                    range: {rangeStr}
                                </h4>
                                <pre
                                    style={{
                                        wordWrap: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {res.contents.map(content => content.value).join('\n')}
                                </pre>
                            </div>
                        );
                    }
                    return (
                        <div key={index}>
                            <h4
                                style={{
                                    margin: '0 0 5px 0',
                                    fontSize: '14px',
                                    color: '#333',
                                    fontWeight: 'bolder'
                                }}
                            >Hover Result {index + 1} - No result</h4>
                            <p>Position: {positionStr}</p>
                        </div>
                    );
                })}
            </div>
        </div>);
}
