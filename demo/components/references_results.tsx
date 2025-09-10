import React from 'react';
import { languages } from 'monaco-editor';
import { SourceLink } from './source_link';
import { WithSource } from '../sql_ls/util';

interface ReferencesResultsProps {
    referencesResults: Array<WithSource<languages.Location[]> | null | undefined>;
    positions: Array<{ lineNumber: number; column: number }>;
}

export function ReferencesResults({ referencesResults, positions }: ReferencesResultsProps) {
    return (
        <div>
            {referencesResults.map((refRes, index) => {
                const positionStr = `(${positions[index].lineNumber}:${positions[index].column})`;
                
                return (
                    <div key={index} style={{ marginBottom: '15px' }}>
                        {refRes && refRes.length > 0 ? (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#007acc',
                                        fontWeight: 'bolder'
                                    }}
                                >References Result {index + 1}
                                    &nbsp;
                                    pos: {positionStr}
                                    &nbsp;
                                    count: {refRes.length}
                                    &nbsp;
                                    <SourceLink source={refRes.__source} />
                                </h4>
                                {refRes.map((ref, refIndex) => (
                                    <div key={refIndex} style={{ marginBottom: '5px', paddingLeft: '10px' }}>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            Reference {refIndex + 1}:
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666', paddingLeft: '10px' }}>
                                            URI: {ref.uri.toString()}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666', paddingLeft: '10px' }}>
                                            Range: ({ref.range.startLineNumber}:{ref.range.startColumn} {'->'} {ref.range.endLineNumber}:{ref.range.endColumn})
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#007acc',
                                        fontWeight: 'bolder'
                                    }}
                                >References Result {index + 1} - No references found</h4>
                                <p>Position: {positionStr}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
