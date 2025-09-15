// This file has been moved to ./components/sql_test_dag.tsx and is now removed from the demo directory.
import React from 'react';
import { caseFromString, LsTestCase } from '../tools/tests';
import { createHiveSqlLanguageService } from '../sql_ls';
import { ContextManager } from '../sql_ls/context_manager';
import { TextHighlight } from './text_highlight';
import tableSourceManager from '../data/example';
import { DisplayContextManager } from './DisplayContextManager';

interface SqlTestVisProps {
    sqlTest: string;
}

interface SqlTestVisState {
    sqlTest: string;
    testCase: LsTestCase | null;
    contextManager: ContextManager | null;
}

export class SqlTestVis extends React.Component<SqlTestVisProps, SqlTestVisState> {
    constructor(props: SqlTestVisProps) {
        super(props);
        this.state = {
            sqlTest: props.sqlTest,
            testCase: null,
            contextManager: null,
            ...SqlTestVis.getDerivedStateFromProps(props, {
                sqlTest: '',
                testCase: null,
                contextManager: null
            }),
        };
    }

    static getDerivedStateFromProps(nextProps: SqlTestVisProps, prevState: SqlTestVisState) {
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
                    <div
                        style={{
                            flex: '1',
                            overflowY: 'auto',
                        }}
                    >
                        <pre style={{
                            position: 'sticky',
                            top: 0,
                            margin: 0, fontSize: '12px', lineHeight: '1.4', overflow: 'auto',
                        }}>
                            <TextHighlight
                                text={this.getCurrentCaseText()}
                                highlights={this.getCurrentCaseHighlights()}
                            />
                        </pre>
                    </div>
                    <div
                        style={{
                            flex: '1',
                            overflowY: 'auto',
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