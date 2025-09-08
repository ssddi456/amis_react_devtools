import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { isPosInParserRuleContext, ITableSourceManager, printNode, rangeFromNode, ruleIndexToDisplayName, TableInfo } from "./sql_ls_helper";
import { uuidv4 } from "./util";
import { MapReduceScope } from "./mr_scope";

interface HighlightRange {
    start: number;
    end: number;
    lineNumber: number;
    column: number;
    type: string;
    context: ParserRuleContext;
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

    referenceMap: Map<string, ParserRuleContext[]> = new Map();

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
        this.children.forEach((child) => {
            child.collectScope();
        });

        const mrScope = this.getMrScope();
        const parent = this.parent;
        this.referenceMap.forEach((refs, name) => {
            const identifier = mrScope?.inputTable.get(name);
            if (identifier) {
                const referenceMap = mrScope!.identifierScope.referenceMap;
                const oldRefs = referenceMap.get(name) || [];
                referenceMap.set(name, [...oldRefs, ...refs].filter(ref => ref !== identifier.defineReference));
                return;
            } else {

                console.log('Reference not found:', name, refs);
                if (parent) {
                    refs.forEach(ref => {
                        parent.addReference(name, ref);
                    });
                }
    
                this.referenceNotFound.set(name, refs);
            }
        });
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

    containsPosition(position: Position): boolean {
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

    addReference(name: string, reference: ParserRuleContext) {
        if (!this.referenceMap.has(name)) {
            this.referenceMap.set(name, []);
        }
        this.referenceMap.get(name)!.push(reference);
    }

    getScopeByIdentifier(name: string): IdentifierScope | null {
        if (this.tableIdentifierMap.has(name)) {
            return this;
        }
        if (this.parent) {
            return this.parent.getScopeByIdentifier(name);
        }
        return null;
    }

    getReferencesByName(name: string): ParserRuleContext[] {
        const references = this.referenceMap.get(name);
        if (references) {
            return references;
        }
        return [];
    }

    addHighlight(range: HighlightRange) {
        if (range.start === range.end) {
            throw new Error(`Highlight ranges should not have zero length: ${JSON.stringify(range)}`);
        }
        this.highlightRanges.push(range);
    }

    addHighlightNode(node: ParserRuleContext) {
        console.log('Adding highlight node:', node);
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

    async getTableInfoByName(tableName: string, dbName: string | undefined): Promise<TableInfo | null> {
        const tableSourceManager = this.tableSourceManager || this.root?.tableSourceManager;
        if (tableSourceManager) {
            return tableSourceManager.getTableInfoByName(tableName, dbName);
        }
        return null;
    }

    validate() {
        const errors: {
            message: string;
            context: ParserRuleContext | TerminalNode; 
            level: 'error' | 'warning';
            type: string;
        }[] = [];
        this.children.forEach(child => {
            errors.push(...child.validate());
        });

        if (this.unsupportedFeatures.length > 0) {
            this.unsupportedFeatures.forEach(feature => {
                errors.push({
                    message: feature.message,
                    context: feature.context,
                    level: 'error',
                    type: 'unsupported_feature'
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
