import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getContextWithCache } from '@amis-devtools/sql-language-service/src';
import { LanguageIdEnum } from '@amis-devtools/sql-language-service/src/consts';
import { ContextManager } from '@amis-devtools/sql-language-service/src/context_manager';
import type { SymbolAndContext } from '@amis-devtools/sql-language-service/src/identifier_scope';
import type { TableInfo, MrScopeNodeData } from '@amis-devtools/sql-language-service/src/types';
import type { editor } from 'monaco-editor';
import { MrScopeDagFlowRef } from '@amis-devtools/sql-devtools-ui/src/components/MrScopeDagFlow';
import { MonacoEditorRef, MonacoEditor } from './components/MonacoEditor';
import { TabNavigationPanel } from './components/TabNavigationPanel';
import { tableSource, sqlTest } from './sqlTest';
import { createStorage } from './template/storage';

type TabType = 'symbols' | 'graph' | 'validation' | 'custom_tables';
const STORAGE_KEY = 'custom-tables-sql';
const { load: loadSql, save: saveSql } = createStorage<string>(STORAGE_KEY, (s) => s, '');
export const App: React.FC = () => {
    const [showHelper, setShowHelper] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('graph');
    const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);
    const [customSql, setCustomSql] = useState(loadSql);
    const [context, setContext] = useState<ContextManager | null>(null);
    const [errors, setErrors] = useState<editor.IMarkerData[]>([]); // To hold validation errors
    
    const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; }>({ nodes: [], edges: [] });

    const editorRef = React.useRef<MonacoEditorRef>(null);
    const flowWrapperRef = React.useRef<MrScopeDagFlowRef>(null);

    // Use custom SQL if it's different from the selected example, otherwise use the example
    const currentSql = customSql || sqlTest[selectedSqlIndex].sql;

    const handleSqlChange = (value: string) => {
        setCustomSql(value);
        saveSql(value);
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
    }, [toEditorPos]);

    const onErrorClick = useCallback((marker: editor.IMarkerData) => {
        toEditorPos(marker.startLineNumber, marker.startColumn);
    }, [toEditorPos]);

    // 处理自定义表格更新
    const handleCustomTableUpdate = useCallback((tables: TableInfo[]) => {
        tableSource.reloadTableInfos();
    }, []);

    // 初始化与父窗口的通信
    // 对应的测试代码
    /**

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'sql_editor_ready') {
            console.log('SQL Editor is ready');
            // 这里可以执行一些初始化操作，比如加载数据等
            event.source?.postMessage({
                type: 'sql_editor_content_change',
                content: 'SELECT id, name, created_at FROM example_table;'
            }, event.origin);

            event.source?.postMessage({
                type: 'sql_editor_table_source_change',
                tableSource: [
                    {
                        db_name: 'default',
                        table_name: 'example_table',
                        description: 'This is an example table',
                        column_list: [
                            { column_name: 'id', description: 'id', data_type_string: 'INT' },
                            { column_name: 'name', description: 'example table', data_type_string: 'STRING' },
                            { column_name: 'created_at', description: 'created at', data_type_string: 'TIMESTAMP' }
                        ],
                    }
                ]
            }, event.origin);
        }
    });
    window.open('http://localhost:3031', 'sql_editor');

    */
    useEffect(() => {
        // 如果有window.opener，发送编辑器就绪消息
        if (window.opener) {
            window.opener.postMessage({ type: 'sql_editor_ready' }, '*');
        }
    }, []);

    // 监听来自父窗口的消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const type = event.data?.type || '';
            if (type.indexOf('sql_editor_') === 0) {
                console.log('Received message from parent:', event.data);
            }
            if (type === 'sql_editor_content_change' && event.data?.content) {
                setCustomSql(event.data.content);
                saveSql(event.data.content);
            }
            if (type === 'sql_editor_table_source_change' && event.data?.tableSource) {
                // setCustomTables(event.data.tableSource);
                tableSource.reloadTableInfos(event.data.tableSource);
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        const { contextManager } = getContextWithCache(currentSql, false, tableSource);
        setContext(contextManager);
        setGraphData(contextManager.getMrScopeGraphNodeAndEdges());
    }, [currentSql]);


    const renderEditor = () => {
        return (
            <div className="editor-section">
                <MonacoEditor
                    ref={editorRef}
                    language={LanguageIdEnum.HIVE}
                    tableSourceManager={tableSource}
                    value={currentSql}
                    onChange={handleSqlChange}
                    onValidate={setErrors}
                    customActions={[
                        {
                            id: 'show_table_list',
                            title: 'Reveal in Graph',
                            run: ({
                                foundNode, contextManager, mrScope,
                            }) => {
                                if (!mrScope || !contextManager) {
                                    return;
                                }
                                const id = foundNode?.getText();
                                let cteScopeId: string = '';
                                mrScope.walkScopes((scope) => {
                                    if (scope.getCteName() === id) {
                                        cteScopeId = scope.id;
                                        return false;
                                    }
                                });

                                if (!cteScopeId) {
                                    return;
                                }
                                if (flowWrapperRef.current) {
                                    flowWrapperRef.current?.fitView({
                                        minZoom: 0.5,
                                        nodes: [{ id: cteScopeId }],
                                        interpolate: 'linear',
                                    });
                                }

                                setActiveTab('graph');
                                setShowHelper(true);

                                setTimeout(() => {
                                    flowWrapperRef.current?.fitView({
                                        minZoom: 0.5,
                                        nodes: [{ id: cteScopeId }],
                                        interpolate: 'linear',
                                    });
                                }, 100);
                            }
                        }
                    ]} />
            </div>
        );
    };

    const renderTab = () => {
        return (
            <TabNavigationPanel
                showHelper={showHelper}
                context={context}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                errors={errors}
                graphData={graphData}
                flowWrapperRef={flowWrapperRef}
                onSymbolClick={onSymbolClick}
                onNodeClick={onNodeClick}
                onErrorClick={onErrorClick}
                handleCustomTableUpdate={handleCustomTableUpdate}
            />
        );
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
