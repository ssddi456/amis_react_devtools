import React from 'react';
import { editor } from 'monaco-editor';
import { SourceLink } from './source_link';
import { WithSource } from '@amis-devtools/sql-language-service/src/helpers/util';

interface ValidationResultsProps {
    validationResults: WithSource<editor.IMarkerData>[] | undefined;
    onErrorClick?: (marker: editor.IMarkerData) => void;
}

export function ValidationResults({ validationResults, onErrorClick }: ValidationResultsProps) {
    return (
        <div>
            {validationResults ? (
                <div>
                    <h4
                        style={{
                            margin: '0 0 10px 0',
                            fontSize: '14px',
                            color: '#333',
                            fontWeight: 'bolder'
                        }}
                    >
                        Validation Results ({validationResults.length} issues)
                    </h4>
                    {
                        <div>
                            {validationResults.map((marker, index) => {
                                const severityColor = marker.severity === 8 ? '#dc3545' : 
                                                    marker.severity === 4 ? '#ffc107' : '#17a2b8';
                                const severityText = marker.severity === 8 ? 'Error' :
                                                   marker.severity === 4 ? 'Warning' : 'Info';
                                
                                return (
                                    <div 
                                        key={index} 
                                        style={{ 
                                            marginBottom: '10px',
                                            padding: '8px',
                                            border: `1px solid ${severityColor}`,
                                            borderRadius: '4px',
                                            backgroundColor: `${severityColor}15`,
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => {
                                            onErrorClick?.(marker);
                                        }}
                                    >
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            marginBottom: '4px'
                                        }}>
                                            <span style={{ 
                                                color: severityColor,
                                                fontWeight: 'bold',
                                                marginRight: '8px'
                                            }}>
                                                {severityText}
                                            </span>
                                            <span style={{ color: '#666', fontSize: '12px' }}>
                                                Line {marker.startLineNumber}:{marker.startColumn} 
                                                {marker.endLineNumber !== marker.startLineNumber || 
                                                 marker.endColumn !== marker.startColumn ? 
                                                    ` → ${marker.endLineNumber}:${marker.endColumn}` : ''}
                                            </span>
                                            <SourceLink source={marker.__source} />
                                        </div>
                                        <div style={{ 
                                            fontFamily: 'monospace',
                                            fontSize: '13px',
                                            color: '#333',
                                            whiteSpace: 'pre-wrap',
                                        }}>
                                            {marker.message}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    }
                </div>
            ) : (
                <div>
                    <h4
                        style={{
                            margin: '0 0 5px 0',
                            fontSize: '14px',
                            color: '#999'
                        }}
                    >
                        Validation Results: No results
                    </h4>
                </div>
            )}
        </div>
    );
}
