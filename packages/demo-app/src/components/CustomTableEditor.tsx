import React, { useState, useEffect, useCallback } from 'react';
import JSON5 from 'json5';
import { MonacoEditor } from './MonacoEditor';
import type { TableInfo } from '@amis-devtools/sql-language-service/src/types';
import { createStorage } from '../template/storage';
import './CustomTableEditor.css';

interface CustomTableEditorProps {
    onTableUpdate?: (tables: TableInfo[]) => void;
}

const STORAGE_KEY = 'custom-tables';

const DEFAULT_TABLE_JSON = `
// 示例表格配置
// [{
//     "db_name": "custom",
//     "table_name": "example_table",
//     "table_id": 1,
//     "description": "示例自定义表格",
//     "column_list": [
//             {
//                 "column_name": "id",
//                 "data_type_string": "bigint",
//                 "description": "主键ID"
//             },
//             {
//                 "column_name": "name", 
//                 "data_type_string": "string",
//                 "description": "名称"
//             },
//             {
//                 "column_name": "created_at",
//                 "data_type_string": "timestamp", 
//                 "description": "创建时间"
//             }
//         ]
//     }
// }]
[]
`;

const tableInfosFromString = (str: string): TableInfo[] => {
    try {
        const parsed = JSON5.parse(str);
        if (Array.isArray(parsed)) {
            return parsed.filter(isValidTableInfo) as TableInfo[];
        }
    } catch (err) {
        console.error('Failed to parse table infos from string:', err);
    }
    return [];
};
// 验证TableInfo结构
const isValidTableInfo = (obj: any): obj is TableInfo => {
    return obj &&
        typeof obj.db_name === 'string' &&
        typeof obj.table_name === 'string' &&
        typeof obj.description === 'string' &&
        Array.isArray(obj.column_list) &&
        obj.column_list.every((col: any) => 
            col &&
            typeof col.column_name === 'string' &&
            typeof col.data_type_string === 'string' &&
            typeof col.description === 'string'
        );
};

const { load, save } = createStorage<TableInfo[]>(STORAGE_KEY, tableInfosFromString, []);
export const loadTableInfosFromStorage = load;
export const CustomTableEditor: React.FC<CustomTableEditorProps> = ({ onTableUpdate }) => {
    const [jsonContent, setJsonContent] = useState<string>('');

    // 从localStorage加载数据
    const loadFromStorage = useCallback(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
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
        save(value);

        onTableUpdate?.(tableInfosFromString(value));
    }, [onTableUpdate]);



    // 重置到默认配置
    const handleReset = () => {
        setJsonContent(DEFAULT_TABLE_JSON);
        const parsed = JSON5.parse(DEFAULT_TABLE_JSON);
        localStorage.setItem(STORAGE_KEY, DEFAULT_TABLE_JSON);
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
