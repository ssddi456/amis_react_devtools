// This file has been moved to ./components/sql_test_dag.tsx and is now removed from the demo directory.
import React from 'react';
import { caseFromString, LsTestCase } from '../tools/tests';
import { createHiveSqlLanguageService } from '../sql_ls';
import { ContextManager } from '../sql_ls/context_manager';
import { IdentifierScope } from "../Identifier_scope";
import { printNode } from "../sql_ls/helpers/log";
import { TextHighlight } from './text_highlight';
import { MapReduceScope } from '../sql_ls/mr_scope';
import tableSourceManager from '../data/example';

interface DisplayContextManagerProps {
    context: IdentifierScope
}

class DisplayMRScope extends React.Component<{ mrScope: MapReduceScope }> {
    render() {
        const { mrScope } = this.props;
        return (
            <div>
                <h4>MapReduce Scope</h4>
                <div>
                    <h5>Input Tables</h5>
                    {Array.from(mrScope.inputTable.keys()).map(name => (
                        <div key={name} style={{ paddingLeft: 12 }}>
                            {name}
                        </div>
                    ))}
                    <h5>Export Columns</h5>
                    {mrScope.exportColumns.map((col, i) => (
                        <div key={i} style={{ paddingLeft: 12 }}>
                            {col.exportColumnName} -&gt; {col.referanceTableName || mrScope.getDefaultInputTableName()} . {col.referanceColumnName}
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
        const mrScope = context.mrScope;
        const tableIdentifierMap = Array.from(context.tableIdentifierMap.keys());
        const tableCount = tableIdentifierMap.length;
        const referenceMap = Array.from(context.referenceMap.keys());
        const referenceCount = referenceMap.length;
        const referenceNotFound = Array.from(context.referenceNotFound.keys());
        const referenceNotFoundCount = referenceNotFound.length;

        return (
            <>
                {mrScope && <DisplayMRScope mrScope={mrScope} />}
                <div
                    style={{
                        marginTop: 12
                    }}
                >
                    <h5>{printNode(context.context)} {context.uuid}</h5>
                    {tableCount ? <div>table declare</div> : null}
                    {
                        tableIdentifierMap.map((table) => {
                            return (
                                <div
                                    key={table}
                                    style={{
                                        paddingLeft: 12,
                                    }}
                                >
                                    <h4>{table}</h4>
                                </div>
                            );
                        })
                    }
                    {referenceCount ? <h4>references</h4> : null}
                    {
                        referenceMap.map((name) => {
                            return (
                                <div key={name}>{name}</div>
                            );
                        })
                    }
                    {referenceNotFoundCount ? <h4>external reference</h4> : null}
                    {
                        referenceNotFound.map((name) => {
                            return (
                                <div key={name}>{name}</div>
                            )
                        })
                    }
                </div>
                {
                    context.children.length > 0
                        ? (
                            <div
                                style={{
                                    marginLeft: 20,
                                    marginTop: 8
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