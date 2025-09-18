import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { TableNameContext, TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { getTableNameFromContext } from "./helpers/table_and_column";
import { isPosInParserRuleContext, Pos, rangeFromNode } from "./helpers/pos";
import { HighlightContext, ITableSourceManager, TableInfo, ValidateError } from "./types";
import { printNode, ruleIndexToDisplayName } from "./helpers/log";
import { uuidv4 } from "./helpers/util";
import { MapReduceScope } from "./mr_scope";
import { ErrorType } from "./consts";


interface HighlightRange {
    start: number;
    end: number;
    lineNumber: number;
    column: number;
    type: string;
    context: HighlightContext;
}

interface UnsupportedFeature {
    message: string;
    context: ParserRuleContext | TerminalNode;
}

export interface SymbolAndContext {
    range: HighlightRange;
    context: IdentifierScope;
    mrScope: MapReduceScope | null;
}

export class IdentifierScope {
    uuid = uuidv4();

    tableIdentifierMap: Map<string, ParserRuleContext> = new Map();

    referenceNotFound: Map<string, ParserRuleContext[]> = new Map();

    defaultIdentifier: ParserRuleContext | null = null;

    children: IdentifierScope[] = [];

    highlightRanges: HighlightRange[] = [];

    mrScope: MapReduceScope | null = null;

    unsupportedFeatures: UnsupportedFeature[] = [];

    tableSourceManager?: ITableSourceManager;

    constructor(
        public context: ParserRuleContext,
        public parent: IdentifierScope | null = null,
        public root: IdentifierScope | null = null,
    ) {
    }

    get range() {
        if (!this.context) {
            return null;
        }

        return {
            startLineNumber: this.context.start!.line,
            startColumn: this.context.start!.column,
            endLineNumber: this.context.stop!.line,
            endColumn: this.context.stop!.column + (this.context.stop!.text || '').length
        };
    }

    getMrScope(): MapReduceScope | null {
        if (this.mrScope) {
            return this.mrScope;
        }
        if (this.parent) {
            return this.parent.getMrScope();
        }
        return null;
    }

    setDefaultIdentifier(identifier: ParserRuleContext) {
        this.defaultIdentifier = identifier;
    }

    addIdentifier(name: string, identifier: ParserRuleContext, isTempTable = false) {
        if (identifier) {
            this.tableIdentifierMap.set(name, identifier);
        }
    }

    getAllIdentifiers() {
        const identifiers = new Map<string, ParserRuleContext>(this.tableIdentifierMap);
        if (this.parent) {
            const parentIdentifiers = this.parent.getAllIdentifiers();
            parentIdentifiers.forEach((value, key) => {
                if (!identifiers.has(key)) {
                    identifiers.set(key, value);
                }
            });
        }
        return identifiers;
    }

    getDefaultIdentifier(): ParserRuleContext | null {
        const defaultIdentifier = this.parent?.defaultIdentifier;
        if (defaultIdentifier) {
            if (defaultIdentifier instanceof TableSourceContext) {
                const tableName = defaultIdentifier.tableOrView().getText();
                const parentRes = this.parent?.lookupDefinition(tableName);
                if (parentRes) {
                    return parentRes;
                }
            }
            return defaultIdentifier;
        }
        return null;
    }

    enterScope(context: ParserRuleContext) {
        const newScope = new IdentifierScope(context, this, this.root || this);
        this.children.push(newScope);
        return newScope;
    }

    collectScope() {
        console.group(`IdentifierScope.collectScope`);
        this.children.forEach((child) => {
            child.collectScope();
        });

        this.highlightRanges.forEach(range => {
            const context = range.context;

            const {tableId, dbName} = getTableNameFromContext(context);
            // console.log(`IdentifierScope.collectScope: context=${printNode(context)}, tableId=${tableId}, dbName=${dbName}`);
            if (tableId) {
                const mrScope = this.getMrScope()?.getTableScopeByName(tableId);
                if (mrScope) {
                    mrScope.addTableReference(tableId, context);
                }
            }

            if (context instanceof TableNameContext) {
                const tableName = context.getText();
                const mrScope = this.getMrScope()?.getParentMrScope()?.getTableScopeByName(tableName);
                if (mrScope) {
                    mrScope.addTableReference(tableName, context);
                }
            }
        });


        console.groupEnd();
    }

    lookupDefinition(name: string): ParserRuleContext | null {
        const identifier = this.tableIdentifierMap.get(name);
        if (!identifier) {
            if (this.parent) {
                return this.parent.lookupDefinition(name);
            }
            const missingRef = this.referenceNotFound.get(name);
            if (missingRef) {
                return missingRef[0];
            }
            return null;
        }
        if (identifier instanceof TableSourceContext) {
            const name = identifier.tableOrView().getText();
            const parentRes = this.parent?.lookupDefinition(name);
            if (parentRes) {
                return parentRes;
            }
            return identifier;
        }
        return identifier;
    }

    getDefinitionScope(name: string): MapReduceScope | null {
        const identifier = this.tableIdentifierMap.get(name);
        if (!identifier) {
            if (this.parent) {
                return this.parent.getDefinitionScope(name);
            }
            const missingRef = this.referenceNotFound.get(name);
            if (missingRef) {
                this.getMrScope();
            }
            return this.root?.getMrScope() || null;
        }
        
        return this.getMrScope();
    }

    containsPosition(position: Pos): boolean {
        if (!this.range) {
            return false;
        }
        return isPosInParserRuleContext(position, this.context);
    }

    toString(depth: number = 0, result: string[] = []) {
        const indent = ' '.repeat(depth * 2);
        result.push(`${indent}(${printNode(this.context)})`);
        const identifiers = this.tableIdentifierMap.entries();
        Array.from(identifiers).forEach(([name, identifier]) => {
            result.push(`${indent}  ${name} -> ${printNode(identifier)}`);
        });
        this.children.forEach(child => {
            child.toString(depth + 1, result);
        });
        return result.join('\n');
    }

    addHighlight(range: HighlightRange) {
        if (range.start === range.end) {
            throw new Error(`Highlight ranges should not have zero length: ${JSON.stringify(range)}`);
        }
        this.highlightRanges.push(range);
    }

    addHighlightNode(node: HighlightContext) {
        const range = rangeFromNode(node);
        this.addHighlight({
            start: node.start?.start || 0,
            end: (node.stop?.stop || 0) + 1,
            lineNumber: range.endLineNumber,
            column: range.endColumn - 1,
            type: ruleIndexToDisplayName(node) || '',
            context: node
        });
    }

    getHighlights(ret: HighlightRange[] = []) {
        this.children.forEach(child => {
            child.getHighlights(ret);
        });
        this.highlightRanges.forEach(range => {
            ret.push(range);
        });

        ret.sort((a, b) => {
            if (a.start !== b.start) {
                return a.start - b.start;
            }
            throw new Error(`Highlights should not have the same start position: ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
            return a.end - b.end;
        });

        return ret;
    }

    getSymbolsAndContext(ret: SymbolAndContext[] = []) {
        this.children.forEach(child => {
            child.getSymbolsAndContext(ret);
        });
        
        this.highlightRanges.forEach(range => {
            ret.push({
                range,
                context: this,
                mrScope: this.getMrScope()?.getScopeByPosition(range) || null
            });
        });

        return ret;
    }

    addUnsupportedFeature(message: string, context: ParserRuleContext | TerminalNode) {
        this.unsupportedFeatures.push({ message, context });
    }

    async getForeignTableInfoByName(tableName: string, dbName: string | undefined): Promise<TableInfo | null> {
        const tableSourceManager = this.tableSourceManager || this.root?.tableSourceManager;
        if (tableSourceManager) {
            return tableSourceManager.getTableInfoByName(tableName, dbName);
        }
        return null;
    }

    validate() {
        const errors: ValidateError[] = [];
        this.children.forEach(child => {
            errors.push(...child.validate());
        });

        if (this.unsupportedFeatures.length > 0) {
            this.unsupportedFeatures.forEach(feature => {
                errors.push({
                    message: feature.message,
                    context: feature.context,
                    level: 'error',
                    type: ErrorType.UnsupportedFeature
                });
            });
        }

        if (this.mrScope) {
            const mrErrors = this.mrScope.validate();
            mrErrors.forEach(err => {
                errors.push({
                    ...err,
                    context: err.context || this.context
                });
            });
        }

        return errors;
    }
}
