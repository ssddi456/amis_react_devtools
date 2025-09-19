import React, { useCallback, useEffect, useState } from 'react';
import { render } from 'react-dom';
import './styles.css';

// Import our custom Monaco SQL editor
import { MonacoSqlEditor, MonacoSqlEditorRef } from './components/MonacoSqlEditor';
import { ContextManager } from '@amis-devtools/sql-language-service/src/context_manager';
import { ContextManagerProvider } from '@amis-devtools/sql-devtools-ui/src/components/ContextManagerContext';
import { MrScopeDagFlow } from '@amis-devtools/sql-devtools-ui/src/components/MrScopeDagFlow';
import { DisplaySymbols } from '@amis-devtools/sql-devtools-ui/src/components/DisplaySymbols';
import { ValidationResults } from "@amis-devtools/sql-devtools-ui/src/components/validation_results";

import type { editor } from 'monaco-editor';
import { getContextWithCache } from '@amis-devtools/sql-language-service/src';
import type { MrScopeNodeData } from '@amis-devtools/sql-language-service/src/types';
import type { SymbolAndContext } from '@amis-devtools/sql-language-service/src/identifier_scope';
import { sqlTest, tableSource } from './sqlTest';

// Setup Monaco Environment for SQL editing
(window as any).MonacoEnvironment = {
    getWorker(workerId: string, label: string) {
        return null;
    }
};

type TabType = 'symbols' | 'graph' | 'validation';


const DemoApp: React.FC = () => {
    const [showHelper, setShowHelper] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('graph');
    const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);
    const [customSql, setCustomSql] = useState('');
    const [context, setContext] = useState<ContextManager | null>(null);
    const [errors, setErrors] = useState<editor.IMarkerData[]>([]); // To hold validation errors
    const editorRef = React.useRef<MonacoSqlEditorRef>(null);

    // Use custom SQL if it's different from the selected example, otherwise use the example
    const currentSql = customSql || sqlTest[selectedSqlIndex].sql;

    const handleSqlChange = (value: string) => {
        setCustomSql(value);
    };

    const handleExampleSelect = (index: number) => {
        setSelectedSqlIndex(index);
        setCustomSql(sqlTest[index]?.sql || '');
    };

    const toEditorPos = useCallback((lineNumber: number, column: number) => {
        const editor = editorRef.current?.getEditor();
        if (editor) {
            editor.revealLineInCenter(lineNumber);
            editor.setPosition({ lineNumber, column });
            editor.focus();
        }
    }, []);

    const onSymbolClick = useCallback((symbol: SymbolAndContext) => {
        toEditorPos(symbol.range.lineNumber, symbol.range.column);
    }, [toEditorPos]);
    const onNodeClick = useCallback((nodeId: string, nodeData: MrScopeNodeData) => {
        toEditorPos(nodeData.pos?.lineNumber || 1, nodeData.pos?.column || 1);
    }, [toEditorPos])

    const onErrorClick = useCallback((marker: editor.IMarkerData) => {
        toEditorPos(marker.startLineNumber, marker.startColumn);
    }, [toEditorPos]);

    useEffect(() => {
        const { contextManager } = getContextWithCache(currentSql, false, tableSource);
        setContext(contextManager);
    }, [currentSql]);


    const renderEditor = () => {
        return (
            <div className="editor-section">
                <MonacoSqlEditor
                    ref={editorRef}
                    tableSourceManager={tableSource}
                    value={currentSql}
                    onChange={handleSqlChange}
                    onValidate={setErrors}
                />
            </div>
        );
    }

    const renderTab = () => {
        if (!showHelper) {
            return null;
        }
        if (!context) {
            return (
                <div className='helper-section'>12312312</div>
            )
        }
        return (<div className='helper-section'>
            <nav className="tab-navigation">
                <button
                    onClick={() => setActiveTab('symbols')}
                    className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`}
                >
                    Symbols
                </button>
                <button
                    onClick={() => setActiveTab('graph')}
                    className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
                >
                    Graph
                </button>
                <button
                    onClick={() => setActiveTab('validation')}
                    className={`tab-btn ${activeTab === 'validation' ? 'active' : ''}`}
                >
                    Errors ({errors.length})
                </button>
            </nav>

            <ContextManagerProvider contextManager={context}>
                {renderTabContent(context)}
            </ContextManagerProvider>
        </div>)
    }
    const renderTabContent = (context: ContextManager) => {
        switch (activeTab) {

            case 'symbols':
                return (
                    <div className="tab-content">
                        <DisplaySymbols
                            contextManager={context}
                            onNodeClick={onSymbolClick}
                        />
                    </div>
                );

            case 'graph': {

                const graphData = context.getMrScopeGraphNodeAndEdges();

                return (
                    <div className="tab-content">
                        <MrScopeDagFlow
                            nodes={graphData.nodes}
                            edges={graphData.edges}
                            onNodeDoubleClick={onNodeClick}
                        />
                    </div>
                );
            }
            case 'validation': {
                return (
                    <div className="tab-content">
                        <ValidationResults
                            validationResults={errors}
                            onErrorClick={onErrorClick}
                        />
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="demo-app">
            <header className="app-header">
                <h1>SQL Development Helper</h1>
            </header>
            <main className="app-main">
                <div className="editor-header">
                    <div className="example-selector">
                        <label htmlFor="sql-examples">SQL Examples: </label>
                        <select 
                            id="sql-examples"
                            value={selectedSqlIndex} 
                            onChange={(e) => handleExampleSelect(Number(e.target.value))}
                            className="example-dropdown"
                        >
                            {sqlTest.map((example, index) => (
                                <option key={index} value={index}>
                                    {example.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowHelper(!showHelper)}
                        className={`helper-btn ${showHelper ? 'active' : ''}`}
                        title={showHelper ? 'Hide' : 'Show'}
                    >
                        {showHelper ? 'Hide helper' : 'Show helper'}
                    </button>
                </div>
                <div className='editor-container'>
                    {renderEditor()}
                    {renderTab()}
                </div>
            </main>

            <footer className="app-footer">
                <p>Built with components from @amis-devtools/sql-devtools-ui | Powered by Monaco Editor & Hive SQL Language Service</p>
            </footer>
        </div>
    );
};

const root = document.querySelector('#root');
if (root) {
    render(<DemoApp />, root);
}
