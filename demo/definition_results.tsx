import React from 'react';
import { languages } from 'monaco-editor';
import { WithSource } from './ls_helper';
import { SourceLink } from './source_link';

interface DefinitionResultsProps {
    definitionResults: Array<WithSource<languages.Definition> | undefined>;
    positions: Array<{ lineNumber: number; column: number }>;
}

export function DefinitionResults({ definitionResults, positions }: DefinitionResultsProps) {
    return (
        <div>
            {definitionResults.map((defRes, index) => {
                const positionStr = `(${positions[index].lineNumber}:${positions[index].column})`;
                
                return (
                    <div key={index} style={{ marginBottom: '15px' }}>
                        {defRes ? (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#666',
                                        fontWeight: 'bolder'
                                    }}
                                >Definition Result {index + 1}
                                    &nbsp;
                                    pos: {positionStr}
                                    &nbsp;
                                    <SourceLink source={defRes.__source} />
                                </h4>
                                {Array.isArray(defRes) ? (
                                    defRes.map((def, defIndex) => (
                                        <div key={defIndex} style={{ marginBottom: '5px' }}>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                                URI: {def.uri.toString()}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                                Range: ({def.range.startLineNumber}:{def.range.startColumn} {'->'} {def.range.endLineNumber}:{def.range.endColumn})
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            URI: {defRes.uri.toString()}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            Range: ({defRes.range.startLineNumber}:{defRes.range.startColumn} {'->'} {defRes.range.endLineNumber}:{defRes.range.endColumn})
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#666',
                                        fontWeight: 'bolder'
                                    }}
                                >Definition Result {index + 1} - No result</h4>
                                <p>Position: {positionStr}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
