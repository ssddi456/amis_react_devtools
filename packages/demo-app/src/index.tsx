import React, { useState } from 'react';
import { render } from 'react-dom';
import './styles.css';

// Import components from sql-devtools-ui
import { SqlTestVis } from '@amis-devtools/sql-devtools-ui/src/components/sql_test_vis';
import { SqlTestDag } from '@amis-devtools/sql-devtools-ui/src/components/sql_test_dag';
import { SqlTestNavigation } from '@amis-devtools/sql-devtools-ui/src/components/sql_test_navigation';
import { sqlTest } from '@amis-devtools/sql-devtools-ui/src/cases';

// Import our custom Monaco SQL editor
import { MonacoSqlEditor } from './components/MonacoSqlEditor';

// Setup Monaco Environment for SQL editing
(window as any).MonacoEnvironment = {
  getWorker(workerId: string, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/json/json.worker",
          // @ts-ignore
          import.meta.url
        )
      );
    }
    if (label === 'hivesql') {
      return new Worker(
        new URL(
          "monaco-sql-languages/esm/languages/hive/hive.worker",
          // @ts-ignore
          import.meta.url
        )
      );
    }
    return null;
  }
};

type TabType = 'editor' | 'symbols' | 'graph';

const DemoApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'context' | 'dag'>('context');
  const [customSql, setCustomSql] = useState(sqlTest[0]?.model?.getValue() || '');

  // Use custom SQL if it's different from the selected example, otherwise use the example
  const currentSql = customSql;

  const handleSqlChange = (value: string) => {
    setCustomSql(value);
  };

  const handleExampleSelect = (index: number) => {
    setSelectedSqlIndex(index);
    setCustomSql(sqlTest[index]?.model?.getValue() || '');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'editor':
        return (
          <div className="tab-content">
            <h2>SQL Editor View</h2>
            <p>Monaco editor with Hive SQL language service integration</p>
            
            <div className="sql-navigation">
              <h3>Example SQL Queries:</h3>
              <SqlTestNavigation
                sqlTest={sqlTest}
                onChange={handleExampleSelect}
              />
            </div>
            
            <div className="sql-editor-container">
              <h3>SQL Editor (with Language Service):</h3>
              <MonacoSqlEditor
                value={currentSql}
                onChange={handleSqlChange}
                height={500}
              />
              
              <div className="editor-features">
                <h4>Features Available:</h4>
                <ul>
                  <li>✅ Syntax highlighting for Hive SQL</li>
                  <li>✅ Auto-completion for tables and columns</li>
                  <li>✅ Error detection and validation</li>
                  <li>✅ Go to definition support</li>
                  <li>✅ Reference finding</li>
                  <li>✅ Hover information</li>
                  <li>✅ Code formatting</li>
                </ul>
              </div>
            </div>
          </div>
        );
        
      case 'symbols':
        return (
          <div className="tab-content">
            <h2>Symbol Table View</h2>
            <p>View and analyze SQL symbols: CTEs, SELECT statements, columns, and foreign tables</p>
            
            <div className="view-mode-selector">
              <button
                onClick={() => setViewMode('context')}
                className={`mode-btn ${viewMode === 'context' ? 'active' : ''}`}
              >
                Context View (CTE/Select/Column)
              </button>
              <button
                onClick={() => setViewMode('dag')}
                className={`mode-btn ${viewMode === 'dag' ? 'active' : ''}`}
              >
                DAG View
              </button>
            </div>
            
            <div className="symbols-container">
              {viewMode === 'context' ? (
                <SqlTestVis sqlTest={currentSql} />
              ) : (
                <SqlTestDag sqlTest={currentSql} />
              )}
            </div>
          </div>
        );
        
      case 'graph':
        return (
          <div className="tab-content">
            <h2>CTE Graph View</h2>
            <p>Visualize table relationships and Common Table Expressions as an interactive graph</p>
            
            <div className="graph-container">
              <SqlTestDag sqlTest={currentSql} />
            </div>
            
            <div className="graph-features">
              <h4>Graph Features:</h4>
              <ul>
                <li>✅ Interactive node-based visualization</li>
                <li>✅ Table dependency relationships</li>
                <li>✅ CTE (Common Table Expression) flow</li>
                <li>✅ Zoom and pan controls</li>
                <li>✅ Node selection and highlighting</li>
              </ul>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="demo-app">
      <header className="app-header">
        <h1>SQL Development Helper - Demo App</h1>
        <p>A free-to-use SQL development helper with usage examples</p>
      </header>
      
      <nav className="tab-navigation">
        <button
          onClick={() => setActiveTab('editor')}
          className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
        >
          📝 SQL Editor
        </button>
        <button
          onClick={() => setActiveTab('symbols')}
          className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`}
        >
          🔍 Symbol Table
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
        >
          🌐 CTE Graph
        </button>
      </nav>
      
      <main className="app-main">
        {renderTabContent()}
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
