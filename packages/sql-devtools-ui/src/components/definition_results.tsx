import React from 'react';
import { languages } from 'monaco-editor';
import { SourceLink } from './source_link';
import { WithSource } from '@amis-devtools/sql-language-service/src/helpers/util';

interface DefinitionResultsProps {
    definitionResults: Array<WithSource<languages.Definition> | null | undefined>;
}

export function DefinitionResults({ definitionResults }: DefinitionResultsProps) {
    return (
        <div>
            {definitionResults.map((defRes, index) => {                
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
                                >Definition Result {index + 1}</h4>
                                <div>No definition found</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
