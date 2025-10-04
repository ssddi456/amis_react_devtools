import * as vscode from 'vscode';
import { registerHivesqlLs } from './languageService/registerLs';
import { ITableSourceManager } from "@amis-devtools/sql-language-service/src/types";
import './helper/register_channel';

console.log('Extension "sql-devtools-vscode-extension" is loaded');

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "sql-devtools-vscode-extension" is now active!');
    const tableSourceManager: ITableSourceManager = {
        // Implement the methods required by ITableSourceManager
        getTableInfoByName(tableName, dbName) {
            // TOOD: load from config file
            return null;
        },
    };

    const disposable = registerHivesqlLs({
        tableSourceManager,
        onCopyToClipboard: (text) => {
            vscode.env.clipboard.writeText(text);
        },
        context,
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Clean up resources if necessary
}