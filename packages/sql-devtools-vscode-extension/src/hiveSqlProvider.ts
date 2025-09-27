import * as monaco from 'monaco-editor';
import { ITableSourceManager } from './languageService/types';
import { createHiveSqlLanguageService } from './languageService/index';

export class HiveSqlProvider {
    private tableSourceManager: ITableSourceManager;

    constructor(tableSourceManager: ITableSourceManager) {
        this.tableSourceManager = tableSourceManager;
    }

    public provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        return context.doComplete(position);
    }

    public provideHover(model: monaco.editor.ITextModel, position: monaco.Position) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        return context.doHover(position);
    }

    public provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        return context.doDefinition(position);
    }

    public provideReferences(model: monaco.editor.ITextModel, position: monaco.Position) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        return context.doReferences(position);
    }

    public provideCodeActions(model: monaco.editor.ITextModel, range: monaco.Range) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        return context.doProvideCodeActions(range);
    }

    public formatDocument(model: monaco.editor.ITextModel) {
        const context = createHiveSqlLanguageService({ model, tableSourceManager: this.tableSourceManager });
        const formatted = context.formatHiveSQL(model.getValue());
        return [
            {
                range: model.getFullModelRange(),
                text: formatted,
            }
        ];
    }
}