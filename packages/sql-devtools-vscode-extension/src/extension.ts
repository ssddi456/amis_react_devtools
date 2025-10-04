import * as vscode from 'vscode';
import { registerHivesqlLs } from './languageService/registerLs';
import { ITableSourceManager, TableInfo } from "@amis-devtools/sql-language-service/src/types";
import './helper/register_channel';

console.log('Extension "sql-devtools-vscode-extension" is loaded');

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "sql-devtools-vscode-extension" is now active!');

    const config = vscode.workspace.getConfiguration('sqlDevtools');
    console.log('Current configuration:', config);
    let tableInfos = (config.get('tableInfos') || []) as TableInfo[];
    const tableSourceManager: ITableSourceManager = {
        // Implement the methods required by ITableSourceManager
        getTableInfoByName(tableName, dbName) {
            // TODO: load from config file
            return tableInfos.find(table => table.table_name === tableName && table.db_name === dbName) || null;
        },
    };

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('sqlDevtools.tableInfos')) {
            const updatedConfig = vscode.workspace.getConfiguration('sqlDevtools');
            tableInfos = (updatedConfig.get('tableInfos') || []) as TableInfo[];
            console.log('Updated tableInfos configuration:', tableInfos);
        }
    }));

    const disposable = registerHivesqlLs({
        tableSourceManager,
        onCopyToClipboard: (text) => {
            vscode.env.clipboard.writeText(text);
        },
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Clean up resources if necessary
}