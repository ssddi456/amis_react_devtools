import React from 'react';
import { ContextManagerProvider } from '@amis-devtools/sql-devtools-ui/src/components/ContextManagerContext';
import { DisplaySymbols } from '@amis-devtools/sql-devtools-ui/src/components/DisplaySymbols';
import { MrScopeDagFlowRef, MrScopeDagFlow } from '@amis-devtools/sql-devtools-ui/src/components/MrScopeDagFlow';
import { ValidationResults } from '@amis-devtools/sql-devtools-ui/src/components/validation_results';
import { ContextManager } from '@amis-devtools/sql-language-service/src/context_manager';
import type { SymbolAndContext } from '@amis-devtools/sql-language-service/src/identifier_scope';
import type { TableInfo, MrScopeNodeData } from '@amis-devtools/sql-language-service/src/types';
import type { editor } from 'monaco-editor';
import { CustomTableEditor } from './CustomTableEditor';
import { tableSource } from '../sqlTest';

type TabType = 'symbols' | 'graph' | 'validation' | 'custom_tables';

interface TabNavigationPanelProps {
    showHelper: boolean;
    context: ContextManager | null;
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    errors: editor.IMarkerData[];
    graphData: { nodes: any[]; edges: any[]; };
    flowWrapperRef: React.RefObject<MrScopeDagFlowRef>;
    onSymbolClick: (symbol: SymbolAndContext) => void;
    onNodeClick: (nodeId: string, nodeData: MrScopeNodeData) => void;
    onErrorClick: (marker: editor.IMarkerData) => void;
    handleCustomTableUpdate: (tables: TableInfo[]) => void;
}

export const TabNavigationPanel: React.FC<TabNavigationPanelProps> = ({
    showHelper,
    context,
    activeTab,
    setActiveTab,
    errors,
    graphData,
    flowWrapperRef,
    onSymbolClick,
    onNodeClick,
    onErrorClick,
    handleCustomTableUpdate
}) => {
    const renderTabContent = (context: ContextManager) => {
        switch (activeTab) {
            case 'symbols':
                return (
                    <div className="tab-content">
                        <DisplaySymbols
                            contextManager={context}
                            onNodeClick={onSymbolClick} />
                    </div>
                );

            case 'graph': {
                return (
                    <div className="tab-content">
                        <MrScopeDagFlow
                            ref={flowWrapperRef}
                            nodes={graphData.nodes}
                            edges={graphData.edges}
                            onNodeDoubleClick={onNodeClick} />
                    </div>
                );
            }
            case 'validation': {
                return (
                    <div className="tab-content">
                        <ValidationResults
                            validationResults={errors}
                            onErrorClick={onErrorClick} />
                    </div>
                );
            }

            case 'custom_tables': {
                return (
                    <div className="tab-content">
                        <CustomTableEditor
                            onTableUpdate={handleCustomTableUpdate} />
                    </div>
                );
            }

            default:
                return null;
        }
    };

    if (!showHelper) {
        return null;
    }
    
    if (!context) {
        return (
            <div className='helper-section'></div>
        );
    }
    
    return (
        <div className='helper-section'>
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
                <button
                    onClick={() => setActiveTab('custom_tables')}
                    className={`tab-btn ${activeTab === 'custom_tables' ? 'active' : ''}`}
                >
                    Custom Tables ({tableSource.getTableCount()})
                </button>
            </nav>

            <ContextManagerProvider contextManager={context}>
                {renderTabContent(context)}
            </ContextManagerProvider>
        </div>
    );
};