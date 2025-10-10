import React, { useState, useEffect, useCallback } from 'react';
import JSON5 from 'json5';
import { MonacoEditor } from './MonacoEditor';
import type { TableInfo } from '@amis-devtools/sql-language-service/src/types';
import './CustomTableEditor.css';
import { DEFAULT_TABLE_JSON, saveTableInfosToStorage, TABLE_STORAGE_KEY, tableInfosFromString } from '../sqlTest';

interface CustomTableEditorProps {
    onTableUpdate?: (tables: TableInfo[]) => void;
}

export const CustomTableEditor: React.FC<CustomTableEditorProps> = ({ onTableUpdate }) => {
    const [jsonContent, setJsonContent] = useState<string>('');

    // 从localStorage加载数据
    const loadFromStorage = useCallback(() => {
        try {
            const stored = localStorage.getItem(TABLE_STORAGE_KEY);
            if (stored) {
                setJsonContent(stored);
            } else {
                setJsonContent(DEFAULT_TABLE_JSON);
            }
        } catch (err) {
            console.error('Failed to load from storage:', err);
            setJsonContent(DEFAULT_TABLE_JSON);
        }
    }, [onTableUpdate]);

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    // 处理JSON内容变化
    const handleJsonChange = useCallback((value: string) => {
        setJsonContent(value);
        
        // 保存到localStorage
        saveTableInfosToStorage(value);

        onTableUpdate?.(tableInfosFromString(value));
    }, [onTableUpdate]);

    // 重置到默认配置
    const handleReset = () => {
        setJsonContent(DEFAULT_TABLE_JSON);
        const parsed = JSON5.parse(DEFAULT_TABLE_JSON);
        saveTableInfosToStorage(DEFAULT_TABLE_JSON);
        onTableUpdate?.(parsed);
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON5.stringify(JSON5.parse(jsonContent)));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "custom_tables.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    return (
        <div className="custom-table-editor">
            <div className="custom-table-editor-header">
                <button
                    onClick={handleReset}
                    title='重置为默认配置(将清空所有配置)'
                >
                    重置
                </button>
                <button
                    onClick={handleExport}
                    title='导出当前配置为JSON文件'
                >
                    导出
                </button>
            </div>
            <div className="custom-table-editor-body">
                <MonacoEditor
                    language="json"
                    value={jsonContent}
                    onChange={handleJsonChange}
                />        
            </div>
        </div>
    );
};
