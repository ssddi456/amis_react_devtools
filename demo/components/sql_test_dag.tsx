// This file has been moved to ./components/sql_test_dag.tsx and is now removed from the demo directory.
import React from 'react';
import { caseFromString, LsTestCase } from '../tools/tests';
import { createHiveSqlLanguageService } from '../sql_ls';
import { ContextManager } from '../sql_ls/context_manager';
import { printNode } from "../sql_ls/helpers/log";
import { TextHighlight } from './text_highlight';
import { MapReduceScope } from '../sql_ls/mr_scope';
import tableSourceManager from '../data/example';
import { IdentifierScope } from '../sql_ls/identifier_scope';

interface DisplayContextManagerProps {
    context: IdentifierScope
}

class DisplayMRScope extends React.Component<{ mrScope: MapReduceScope }> {
    render() {
        const { mrScope } = this.props;

        const inputTableKeys = Array.from(mrScope.inputTable.keys());
        const tableDefinitionsKeys = Array.from(mrScope.tableDefinitions.keys());
        const exportColumns = mrScope.exportColumns;
        const tableReferenceKeys = Array.from(mrScope.tableReferences.keys());
        
        return (
            <div>
                <div>MapReduce Scope [{mrScope.mrOrder}]</div>
                <div>
                    {inputTableKeys.length !== 0 ? <div>inputTable</div> : null}
                    {inputTableKeys.map(name => {
                        const inputTable = mrScope.inputTable.get(name);
                        if (!inputTable) {
                            return null;
                        }
                        return (
                            <div key={name} style={{ paddingLeft: 12 }}>
                                {name} -&gt; {printNode(inputTable!.reference)}
                            </div>
                        );
                    })}
                    {tableDefinitionsKeys.length !== 0 ? <div>tableDefinitions</div> : null}
                    {tableDefinitionsKeys.map(name => {
                        const tableDef = mrScope.tableDefinitions.get(name);
                        if (!tableDef) {
                            return null;
                        }
                        return (
                            <div key={name} style={{ paddingLeft: 12 }}>
                                {name} -&gt; {printNode(tableDef!.reference)}
                            </div>
                        );
                    })}
                    {exportColumns.length !== 0 ? <div>exportColumns</div> : null}
                    {exportColumns.map((col, i) => (
                        <div key={i} style={{ paddingLeft: 12 }}>
                            {col.exportColumnName} -&gt; {col.referanceTableName || mrScope.getDefaultInputTableName()} . {col.referanceColumnName}
                        </div>
                    ))}
                    {tableReferenceKeys.length !== 0 ? <div>tableReferences</div> : null}
                    {tableReferenceKeys.map(name => (
                        <div key={name}>
                            <div key={name} style={{ paddingLeft: 12 }}>
                                {name}
                            </div>
                            <div style={{ paddingLeft: 24 }}>
                                {Array.from(mrScope.tableReferences.get(name) || []).map((col, i) => (
                                    <div key={i}>
                                        {printNode(col)}
                                    </div>
                                ))}
                            </div>
                        </div>

                    ))}
                </div>
            </div>
        );
    }
}

class DisplayContextManager extends React.Component<DisplayContextManagerProps> {
    render() {
        const context = this.props.context;
        console.log('DisplayContextManager', context);
        const mrScope = context.mrScope;
        const tableIdentifierMap = Array.from(context.tableIdentifierMap.keys());
        const tableCount = tableIdentifierMap.length;
        const referenceMap = Array.from(context.referenceMap.keys());
        const referenceCount = referenceMap.length;
        const referenceNotFound = Array.from(context.referenceNotFound.keys());
        const referenceNotFoundCount = referenceNotFound.length;
        const highlights = context.highlightRanges;

        return (
            <>
                <div
                    style={{
                        marginTop: 2,
                        display: 'flex',
                        padding: 4,
                        gap: 4,
                        background: '#f0f0f0',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                        }}
                    >
                        <div
                            style={{ borderBottom: '1px solid #ccc', marginBottom: 4 }}
                        >
                            {printNode(context.context)} (c: {context.children.length})
                        </div>
                        {tableCount ? <div>tableIdentifierMap</div> : null}
                        {
                            tableIdentifierMap.map((table) => {
                                return (
                                    <div
                                        key={table}
                                        style={{
                                            paddingLeft: 12,
                                        }}
                                    >
                                        {table}
                                    </div>
                                );
                            })
                        }
                        {referenceCount ? <div>referenceMap</div> : null}
                        {
                            referenceMap.map((name) => {
                                return (
                                    <div key={name} style={{ paddingLeft: 12 }}>
                                        {name}
                                    </div>
                                );
                            })
                        }
                        {referenceNotFoundCount ? <div>referenceNotFound</div> : null}
                        {
                            referenceNotFound.map((name) => {
                                return (
                                    <div key={name} style={{ paddingLeft: 12 }}>
                                        {name}
                                    </div>
                                )
                            })
                        }
                        {highlights.length ? <div>highlights</div> : null}
                        {
                            highlights.map((range, i) => {
                                return (
                                    <div key={i} style={{ paddingLeft: 12 }}>
                                        {printNode(range.context)}
                                    </div>
                                );
                            })
                        }
                    </div>
                    <div
                        style={{
                            flex: 1,
                            paddingLeft: 4,
                            borderLeft: '1px solid #ccc',
                        }}
                    >
                        {mrScope && <DisplayMRScope mrScope={mrScope} />}
                    </div>
                </div>
                {
                    context.children.length > 0
                        ? (
                            <div
                                style={{
                                    marginLeft: 18,
                                    marginTop: 4
                                }}
                            >
                                {context.children.map(x => {
                                    return (
                                        <DisplayContextManager key={x.uuid} context={x} />
                                    )
                                })}
                            </div>
                        )
                        : null
                }
            </>
        );
    }
}

interface SqlTestDagProps {
    sqlTest: string;
}

interface SqlTestDagState {
    sqlTest: string;
    testCase: LsTestCase | null;
    contextManager: ContextManager | null;
}


export class SqlTestDag extends React.Component<SqlTestDagProps, SqlTestDagState> {
    constructor(props: SqlTestDagProps) {
        super(props);
        this.state = {
            sqlTest: props.sqlTest,
            testCase: null,
            contextManager: null,
            ...SqlTestDag.getDerivedStateFromProps(props, {
                sqlTest: '',
                testCase: null,
                contextManager: null
            }),
        };
    }

    static getDerivedStateFromProps(nextProps: SqlTestDagProps, prevState: SqlTestDagState) {
        if (nextProps.sqlTest !== prevState.sqlTest) {
            const testCase = caseFromString(nextProps.sqlTest);
            const model = testCase.model;
            const contextManager = createHiveSqlLanguageService({
                model,
                tableSourceManager,
            }).getContextManager();

            return {
                sqlTest: nextProps.sqlTest,
                testCase,
                contextManager
            };
        }
        return null;
    }

    getCurrentCaseText() {
        const testCase = this.state.testCase;
        return testCase?.model?.getValue() || '';
    }

    getCurrentCaseHighlights() {
        return this.state.contextManager?.getHighlights() || [];
    }

    getCurrentCaseContextManager() {
        return this.state.contextManager;
    }

    render() {
        const context = this.getCurrentCaseContextManager();
        return (
            <div
                style={{
                    maxHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                <h3
                    style={{
                        background: 'white',
                        flex: '0 0 auto',
                    }}
                >SQL Test DAG</h3>
                <div
                    style={{
                        display: 'flex',
                        flex: 1,
                        overflowY: 'auto',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            flex: '1 0 50%',
                            position: 'sticky',
                            top: 0,
                            overflowY: 'auto',
                        }}
                    >
                        <pre>
                            <TextHighlight
                                text={this.getCurrentCaseText()}
                                highlights={this.getCurrentCaseHighlights()}
                            />
                        </pre>
                    </div>
                    <div
                        style={{
                            flex: '1 0 50%',
                        }}
                    >
                        {context && (
                            <DisplayContextManager context={context.rootContext!} />
                        )}
                    </div>
                </div>
            </div>
        );
    }
}