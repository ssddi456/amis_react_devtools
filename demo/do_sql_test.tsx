import { useState, useEffect } from "react";
import { LsTestCase, WithSource } from "./ls_helper";
import { languages } from 'monaco-editor';
import { createHiveLs } from "./sql_ls";
import { HoverResults, DefinitionResults } from "./results_components";


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


export function DoSqlTest({ case: testCase, showDebug }: { case: LsTestCase; showDebug?: boolean }) {
    // 从 localStorage 获取初始 tab 状态，默认为 'hover'
    const [activeTab, setActiveTab] = useState<'hover' | 'definition'>(() => {
        const saved = localStorage.getItem('doSqlTest_activeTab');
        return (saved === 'hover' || saved === 'definition') ? saved : 'hover';
    });

    // 保存 tab 状态到 localStorage
    useEffect(() => {
        localStorage.setItem('doSqlTest_activeTab', activeTab);
    }, [activeTab]);

    const [results, setResult] = useState<{
        model: LsTestCase['model'];
        positions: LsTestCase['positions'];
        hoverResults: (WithSource<languages.Hover> | undefined)[];
        definitionResults: (WithSource<languages.Definition> | undefined)[];
    } | null>(null);

    useEffect(() => {
        const model = testCase.model;
        const positions = testCase.positions;
        const hiveLs = createHiveLs(model);
        const hoverResults = positions.map(pos => {
            const resInfo = hiveLs.doHover(pos, showDebug);
            return resInfo;
        });
        const definitionResults = positions.map(pos => {
            const resInfo = hiveLs.doDefinition(pos, showDebug);
            return resInfo;
        });
        setResult({ model, positions, hoverResults, definitionResults });
    }, [testCase, showDebug]);

    const highlightedText = createHighlightedText(testCase.model.getValue(), testCase.positions);

    // Tab 按钮样式
    const tabButtonStyle = (isActive: boolean) => ({
        padding: '8px 16px',
        border: 'none',
        backgroundColor: isActive ? '#007acc' : '#f0f0f0',
        color: isActive ? 'white' : '#333',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: isActive ? 'bold' : 'normal',
        marginRight: '4px',
        borderRadius: '4px 4px 0 0',
        outline: 'none'
    });

    if (!results) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Loading results...</p>
            </div>
        );
    }

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
                {/* Tab 切换按钮 */}
                <div style={{ marginBottom: '10px', borderBottom: '1px solid #ddd' }}>
                    <button
                        style={tabButtonStyle(activeTab === 'hover')}
                        onClick={() => setActiveTab('hover')}
                    >
                        Hover Results
                    </button>
                    <button
                        style={tabButtonStyle(activeTab === 'definition')}
                        onClick={() => setActiveTab('definition')}
                    >
                        Definition Results
                    </button>
                </div>

                {/* Tab 内容 */}
                {activeTab === 'hover' && (
                    <HoverResults 
                        hoverResults={results.hoverResults} 
                        positions={results.positions} 
                    />
                )}

                {activeTab === 'definition' && (
                    <DefinitionResults 
                        definitionResults={results.definitionResults} 
                        positions={results.positions} 
                    />
                )}
            </div>
        </div>);
}
