import React from 'react';
import { languages } from 'monaco-editor';
import { SourceLink } from './source_link';
import { WithSource } from '../../sql_ls/helpers/util';

interface HoverResultsProps {
    hoverResults: Array<WithSource<languages.Hover> | null | undefined>;
}

export function HoverResults({ hoverResults }: HoverResultsProps) {
    return (
        <div>
            {hoverResults.map((res, index) => {
                return (
                    <div key={index} style={{ marginBottom: '15px' }}>
                        {res ? (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#333',
                                        fontWeight: 'bolder'
                                    }}
                                >Hover Result {index + 1}
                                    &nbsp;
                                    range: {`(${res.range?.startLineNumber}:${res.range?.startColumn} -> ${res.range?.endLineNumber}:${res.range?.endColumn})`}
                                    &nbsp;
                                    <SourceLink source={res.__source} />
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
                        ) : (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '14px',
                                        color: '#333',
                                        fontWeight: 'bolder'
                                    }}
                                >Hover Result {index + 1}
                                </h4>
                                <div>No hover result</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
