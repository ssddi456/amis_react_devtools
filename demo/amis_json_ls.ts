import { editor, languages, type IMarkdownString } from "monaco-editor";
import { getLanguageService } from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-json-languageservice';
import * as lsTypes from 'vscode-languageserver-types';
import { toRange, posToPosition } from "./ls_helper";
import { Pos } from "../sql_ls/helpers/pos";

const amisSchema = require("amis/schema.json");

const {
    RootSchema,
    ...anyOtherSchema
} = amisSchema.definitions;

export function findDefinitionKeyByType(type: string) {
    for (const key in anyOtherSchema) {
        const item = anyOtherSchema[key];
        if (item.type === 'object' && item.properties?.type?.type === 'string') {
            if (item.properties.type.const === type) {
                console.log(key, item);
                return key;
            }
        }
    }
}

export function findTypeValue(root: any) {
    for (let i = 0; i < root.properties.length; i++) {
        const item = root.properties[i];
        if (item.keyNode.value === 'type') {
            if (item.valueNode.type === 'string') {
                return item.valueNode.value;
            }
        }
    }
}

export function makeSchemaForType(type: string) {
    const definitionKey = findDefinitionKeyByType(type);
    if (!definitionKey) {
        return amisSchema;
    }
    const schema = {
        ...amisSchema,
        $ref: `#/definitions/${definitionKey}`,
    };
    return schema;
}

export function toTextEdit(textEdit: lsTypes.TextEdit | undefined): languages.TextEdit | undefined {
    if (!textEdit) {
        return void 0;
    }
    return {
        range: toRange(textEdit.range),
        text: textEdit.newText
    };
}

export function isInsertReplaceEdit(
    edit: lsTypes.TextEdit | lsTypes.InsertReplaceEdit
): edit is lsTypes.InsertReplaceEdit {
    return (
        typeof (<lsTypes.InsertReplaceEdit>edit).insert !== 'undefined' &&
        typeof (<lsTypes.InsertReplaceEdit>edit).replace !== 'undefined'
    );
}

export function toCompletionItemKind(kind: number | undefined): languages.CompletionItemKind {
    const mItemKind = languages.CompletionItemKind;

    switch (kind) {
        case lsTypes.CompletionItemKind.Text:
            return mItemKind.Text;
        case lsTypes.CompletionItemKind.Method:
            return mItemKind.Method;
        case lsTypes.CompletionItemKind.Function:
            return mItemKind.Function;
        case lsTypes.CompletionItemKind.Constructor:
            return mItemKind.Constructor;
        case lsTypes.CompletionItemKind.Field:
            return mItemKind.Field;
        case lsTypes.CompletionItemKind.Variable:
            return mItemKind.Variable;
        case lsTypes.CompletionItemKind.Class:
            return mItemKind.Class;
        case lsTypes.CompletionItemKind.Interface:
            return mItemKind.Interface;
        case lsTypes.CompletionItemKind.Module:
            return mItemKind.Module;
        case lsTypes.CompletionItemKind.Property:
            return mItemKind.Property;
        case lsTypes.CompletionItemKind.Unit:
            return mItemKind.Unit;
        case lsTypes.CompletionItemKind.Value:
            return mItemKind.Value;
        case lsTypes.CompletionItemKind.Enum:
            return mItemKind.Enum;
        case lsTypes.CompletionItemKind.Keyword:
            return mItemKind.Keyword;
        case lsTypes.CompletionItemKind.Snippet:
            return mItemKind.Snippet;
        case lsTypes.CompletionItemKind.Color:
            return mItemKind.Color;
        case lsTypes.CompletionItemKind.File:
            return mItemKind.File;
        case lsTypes.CompletionItemKind.Reference:
            return mItemKind.Reference;
    }
    return mItemKind.Property;
}

export function isMarkupContent(thing: any) {
    return (
        thing && typeof thing === 'object' && thing.kind === 'string'
    );
}

export function toMarkdownString(entry: any): IMarkdownString {
    if (typeof entry === 'string') {
        return {
            value: entry
        };
    }
    if (isMarkupContent(entry)) {
        if (entry.kind === 'plaintext') {
            return {
                value: entry.value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&')
            };
        }
        return {
            value: entry.value
        };
    }

    return { value: '```' + entry.language + '\n' + entry.value + '\n```\n' };
}

export function toMarkedStringArray(
    contents: any
): IMarkdownString[] | undefined {
    if (!contents) {
        return void 0;
    }
    if (Array.isArray(contents)) {
        return contents.map(toMarkdownString);
    }
    return [toMarkdownString(contents)];
}

export const getJSONType = (model: editor.ITextModel) => {
    let schema = amisSchema;
    const jsonls = getLanguageService({
        schemaRequestService: () => Promise.resolve(schema)
    });

    const document = TextDocument.create(model.uri.toString(), 'json', 0, model.getValue());
    const jsonDocument = jsonls.parseJSONDocument(document);
    const typeInfo = findTypeValue(jsonDocument.root);
    if (typeInfo) {
        schema = makeSchemaForType(typeInfo);
    }

    jsonls.configure({
        validate: true,
        schemas: [
            {
                uri: 'https://amis.baidu.com/schema.json',
                fileMatch: ['*'],
                schema: schema
            }
        ]
    });

    return {
        doComplete: (position: Pos) => {
            return jsonls.doComplete(document, posToPosition(position), jsonDocument);
        },
        doHover: (position: Pos) => {
            return jsonls.doHover(document, posToPosition(position), jsonDocument);
        },
    };
}