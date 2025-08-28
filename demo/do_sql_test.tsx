import { useState, useEffect, ReactElement, useCallback } from "react";
import { LsTestCase, WithSource } from "./ls_helper";
import { languages, editor } from 'monaco-editor';
import { createHiveLs } from "./sql_ls";
import { HoverResults, DefinitionResults, ReferencesResults, ValidationResults } from "./results_components";


// 创建高亮文本的辅助函数
export function createHighlightedText(text: string, positions: Array<{ lineNumber: number; column: number }>) {
    const lines = text.split('\n');
    const highlightedLines = lines.map((line, lineIndex) => {
        const lineNumber = lineIndex + 1;
        const linePositions = positions.filter(pos => pos.lineNumber === lineNumber);
        const key = `line-${lineNumber}-${line}`;
        if (linePositions.length === 0) {
            return <div key={key}>{line}</div>;
        }
        const lineLength = line.length;
        // 按列位置排序，从后向前处理以避免索引偏移
        const sortedPositions = linePositions.sort((a, b) => a.column - b.column)

        let result: ReactElement[] = [];

        sortedPositions.forEach((pos, i) => {
            const index = pos.column - 1; // 转换为0索引
            const prevPosition = i > 0 ? sortedPositions[i - 1].column : 0;
            const posIndex = positions.indexOf(pos);
            if (index >= 0 && index < line.length) {
                const char = line[index];
                const prevContent = index > 0 ? line.slice(prevPosition, index) : '';
                if (prevContent) {
                    result.push(<span key={`prev-${i}`}>{prevContent}</span>);
                }
                result.push(
                    <span key={i} style={{ backgroundColor: 'yellow', fontWeight: 'bold', color: 'red', position: 'relative' }}>
                        {char}
                        <sup style={{ color: 'blue', fontSize: '10px', fontWeight: 'bold', userSelect: 'none' }}>
                            {posIndex + 1}
                        </sup>
                    </span>
                );
            }
            if (i == sortedPositions.length - 1) {
                const nextContent = line.slice(index + 1, lineLength);
                if (nextContent) {
                    result.push(<span key={`space-${i}`}>{nextContent}</span>);
                }
            }
        });

        return <div key={key}>{result}</div>;
    });

    return highlightedLines;
}


export function DoSqlTest({ case: testCase, showDebug }: { case: LsTestCase; showDebug?: boolean }) {
    // 从 localStorage 获取初始 tab 状态，默认为 'results'
    const [activeTab, setActiveTab] = useState<'results' | 'validation'>(() => {
        const saved = localStorage.getItem('doSqlTest_activeTab');
        return (saved === 'results' || saved === 'validation') ? saved : 'results';
    });
    const [resultIdx, setResultIdx] = useState(0);
    // 保存 tab 状态到 localStorage
    useEffect(() => {
        localStorage.setItem('doSqlTest_activeTab', activeTab);
    }, [activeTab]);

    const [results, setResult] = useState<{
        model: LsTestCase['model'];
        positions: LsTestCase['positions'];
        validationResults: WithSource<editor.IMarkerData>[] | undefined;
        resultItems: {
            hoverResult: (WithSource<languages.Hover> | undefined);
            definitionResult: (WithSource<languages.Definition> | undefined);
            referencesResult: (WithSource<languages.Location[]> | undefined);
        }[]
    } | null>(null);

    useEffect(() => {
        const model = testCase.model;
        const positions = testCase.positions;
        const hiveLs = createHiveLs(model, showDebug);
        const resultItems = positions.map(pos => {
            const hoverResult = hiveLs.doHover(pos, showDebug);
            const definitionResult = hiveLs.doDefinition(pos, showDebug);
            const referencesResult = hiveLs.doReferences(pos, showDebug);
            return { hoverResult, definitionResult, referencesResult };
        });

        const validationResults = hiveLs.doValidation();
        setResult({
            model, positions,
            validationResults,
            resultItems, 
        });
        setResultIdx(0);
    }, [testCase, showDebug]);

    const reparse = useCallback((idx: number) => {
        const resultItems = results!.resultItems.map((item, i) => {
            if (i === idx) {
                const model = testCase.model;
                const hiveLs = createHiveLs(model, showDebug, true);
                const positions = testCase.positions;
                const pos = positions[i]; // Get the position of the item
                // Apply rephrasing logic to the selected item
                const hoverResult = hiveLs.doHover(pos, showDebug);
                const definitionResult = hiveLs.doDefinition(pos, showDebug);
                const referencesResult = hiveLs.doReferences(pos, showDebug);
                return {
                    hoverResult,
                    definitionResult,
                    referencesResult
                };
            }
            return item;
        });
        setResult(prev => prev ? { ...prev, resultItems } : null);
    }, [results]);

    const reValidate = useCallback(() => {
        const validationResults = createHiveLs(testCase.model, showDebug, true).doValidation();
        setResult(prev => prev ? { ...prev, validationResults } : null);
    }, [results]);
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

    const currentResultItem = results.resultItems[resultIdx];

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
            >
                {highlightedText}
            </div>
            <div
                style={{
                    flex: 1,
                    maxWidth: 'calc(50% - 5px)'
                }}
            >
                {/* Tab 切换按钮 */}
                <div 
                    style={{
                        marginBottom: '10px',
                        borderBottom: '1px solid #ddd',
                        position: 'sticky',
                        top: 0,
                    }}
                >
                    <button
                        style={tabButtonStyle(activeTab === 'results')}
                        onClick={() => setActiveTab('results')}
                    >
                        Results
                    </button>
                    <button
                        style={tabButtonStyle(activeTab === 'validation')}
                        onClick={() => setActiveTab('validation')}
                    >
                        Validation Results
                    </button>
                </div>

                {/* Tab 内容 */}
                {activeTab === 'results' && (
                    <>
                        <div style={{ marginBottom: '10px', display: 'flex', gap: '4px' }}>
                            {results.positions.map((_, idx) => {
                                const result = results.resultItems[idx].hoverResult;
                                return (
                                <button
                                    key={idx}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: idx === resultIdx ? '#007acc' : '#f0f0f0',
                                        color: idx === resultIdx ? 'white' : '#333',
                                        border: !result ? '1px solid red' : 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setResultIdx(idx)}
                                >
                                    {idx + 1}
                                    <span style={{ marginLeft: '4px', fontSize: '12px', color: 'red' }}>
                                        {!results.resultItems[idx].hoverResult ? '!' : null}
                                    </span>
                                </button>
                            )})}
                        </div>
                        <div>
                            <button style={{
                                padding: '4px 8px',
                                backgroundColor: '#007acc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                                onClick={() => {
                                    reparse(resultIdx);
                                }}
                            >
                                rephrase
                            </button>
                        </div>
                        <HoverResults
                            hoverResults={[currentResultItem.hoverResult]} 
                            positions={[results.positions[resultIdx]]} 
                        />
                        <DefinitionResults 
                            definitionResults={[currentResultItem.definitionResult]} 
                            positions={[results.positions[resultIdx]]} 
                        />
                        <ReferencesResults 
                            referencesResults={[currentResultItem.referencesResult]} 
                            positions={[results.positions[resultIdx]]}
                        />
                    </>
                )}


                {activeTab === 'validation' && (
                    <>
                        <div>
                            <button style={{
                                padding: '4px 8px',
                                backgroundColor: '#007acc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                                onClick={() => {
                                    reValidate();
                                }}
                            >
                                reValidate
                            </button>
                        </div>
                        <ValidationResults 
                            validationResults={results.validationResults} 
                        />
                    </>
                )}
            </div>
        </div>);
}
