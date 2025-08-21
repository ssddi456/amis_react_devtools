import React from 'react';
import { caseFromString, LsTestCase } from './ls_helper';
import { createHiveLs } from './sql_ls';
import { IdentifierScope } from './context_manager';

interface DisplayContextManagerProps {
    context: IdentifierScope
}

class DisplayContextManager extends React.Component<DisplayContextManagerProps> {
    render() {
        const context = this.props.context;
        const tableIdentifierMap = Array.from(context.tableIdentifierMap.keys());
        const tableCount = tableIdentifierMap.length;
        const referenceMap = Array.from(context.referenceMap.keys());
        const referenceCount = referenceMap.length;
        const referenceNotFound = Array.from(context.referenceNotFound.keys());
        const referenceNotFoundCount = referenceNotFound.length;
        console.log('tableIdentifierMap', tableIdentifierMap);
        console.log('referenceMap', referenceMap);
        console.log('referenceNotFound', referenceNotFound);
        return (
            <>
                <div>
                    {/* <h5>{context.uuid}</h5> */}
                    {tableCount ? <div>table declare</div> : null}
                    {
                        tableIdentifierMap.map((table) => {
                            const columns = context.tableColumnIdentifierMap.get(table);
                            console.log('table', table, columns);
                            return (
                                <div key={table}>
                                    <h4>{table}</h4>
                                    <ul>
                                        {
                                            columns
                                                ? Object.entries(columns).map(([column, _]) => (
                                                    <li key={column}>{column}</li>
                                                ))
                                                : <li>No columns</li>
                                        }
                                    </ul>
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
                    {referenceNotFoundCount ? <h4>missing reference</h4> : null}
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
                                    marginLeft: '20px'
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
    sqlTest: string[];
}

interface SqlTestDagState {
    currentTestIndex: number;
    sqlTest: string[];
    sqlTestCases: LsTestCase[];
}


export class SqlTestDag extends React.Component<SqlTestDagProps, SqlTestDagState> {
    constructor(props: SqlTestDagProps) {
        super(props);
        this.state = {
            currentTestIndex: 0,
            sqlTest: props.sqlTest,
            sqlTestCases: props.sqlTest.map((test, index) => caseFromString(test))
        };
    }

    static getDerivedStateFromProps(nextProps: SqlTestDagProps, prevState: SqlTestDagState) {
        if (nextProps.sqlTest !== prevState.sqlTest) {
            return {
                sqlTest: nextProps.sqlTest,
                sqlTestCases: nextProps.sqlTest.map((test) => caseFromString(test))
            };
        }
        return null;
    }

    getCurrentCaseText() {
        const testCase = this.state.sqlTestCases[this.state.currentTestIndex];
        return testCase.model.getValue();
    }

    getCurrentCaseContextManager() {
        const testCase = this.state.sqlTestCases[this.state.currentTestIndex];
        const model = testCase.model;
        const contextManager = createHiveLs(model).getContextManager();

        return contextManager;
    }

    render() {
        const context = this.getCurrentCaseContextManager();
        console.log(context);
        return (
            <div>
                <h3>SQL Test DAG</h3>
                <div
                    style={{
                        display: 'flex'
                    }}
                >
                    <div
                        style={{
                            flex: '1 0 50%',
                        }}
                    >
                        <pre>
                            {this.getCurrentCaseText()}
                        </pre>
                    </div>
                    <div
                        style={{
                            flex: '1 0 50%',
                        }}
                    >
                        <DisplayContextManager context={context.rootContext!} />
                    </div>
                </div>
            </div>
        );
    }
}