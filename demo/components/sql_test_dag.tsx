import React from 'react';
import { caseFromString, LsTestCase } from '../tools/tests';
import { createHiveSqlLanguageService } from '../../sql_ls';
import { ContextManager } from '../../sql_ls/context_manager';
import { TextHighlight } from './text_highlight';
import tableSourceManager from '../data/example';
import { DisplayContextManager } from './DisplayContextManager';
import { MrScopeDagFlow } from './MrScopeDagFlow';
import { ContextManagerProvider } from './ContextManagerContext';

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

    sizeRecorder: { [key: string]: { width: number; height: number } } = {};

    debouncedRerender = (() => {
        let timeout: any = null;
        return () => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                this.forceUpdate();
                timeout = null;
            }, 200);
        };
    })();

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

    getMrScopeGraphData() {
        const contextManager = this.getCurrentCaseContextManager();
        if (!contextManager) {
            return { nodes: [], edges: [] };
        }
        const {
            nodes,
            edges
        } = contextManager.getMrScopeGraphNodeAndEdges();
        const nodesWithSizeCallback = nodes.map(node => ({...node, data: {
            ...node.data,
            measured: this.sizeRecorder[node.id] || { width: 100, height: 100 },
            onNodeSizeChange: (nodeId: string, size: { width: number; height: number }) => {
                this.sizeRecorder[nodeId] = size;
                this.debouncedRerender();
            }
        }}));
        return { nodes: nodesWithSizeCallback, edges };
    }

    render() {
        const context = this.getCurrentCaseContextManager();
        const graphData = this.getMrScopeGraphData();

        return (
            <div
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'auto',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        display: 'flex',
                        overflowY: 'auto',
                        position: 'relative',
                        gap: '16px',
                        padding: '16px',
                    }}
                >
                    {/* SQL 代码和高亮显示 */}
                    <div
                        style={{
                            flex: '1 0 30%',
                            minWidth: '300px',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #e1e1e1',
                            borderRadius: '8px',
                            padding: '16px',
                            overflowY: 'auto',
                        }}
                    >
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                            SQL Query
                        </h4>
                        <pre
                            style={{
                                position: 'sticky',
                                top: 0,
                                margin: 0, fontSize: '12px', lineHeight: '1.4', overflow: 'auto',
                            }}
                        >
                            <TextHighlight
                                text={this.getCurrentCaseText()}
                                highlights={this.getCurrentCaseHighlights()}
                            />
                        </pre>
                    </div>

                    {/* MapReduce Scope DAG 可视化 */}
                    <div
                        style={{
                            flex: '2 0 60%',
                            minWidth: '500px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e1e1e1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div
                            style={{
                                padding: '16px',
                                borderBottom: '1px solid #e1e1e1',
                                backgroundColor: '#f8f9fa',
                            }}
                        >
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                                MapReduce Scope DAG
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                                Nodes: {graphData.nodes.length}, Edges: {graphData.edges.length}
                            </p>
                        </div>
                        <div style={{ flex: 1, minHeight: '400px' }}>
                            {graphData.nodes.length > 0 ? (
                                <ContextManagerProvider contextManager={context}>
                                    <MrScopeDagFlow
                                        nodes={graphData.nodes}
                                        edges={graphData.edges}
                                    />
                                </ContextManagerProvider>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        color: '#666',
                                        fontSize: '14px',
                                    }}
                                >
                                    No MapReduce scopes found in this query
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
