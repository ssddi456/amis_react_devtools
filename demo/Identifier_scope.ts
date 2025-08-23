import { ParserRuleContext } from "antlr4ng";
import { TableSourceContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import { Position } from "monaco-sql-languages/esm/fillers/monaco-editor-core";
import { posInRange } from "./ls_helper";
import { printNode, ruleIndexToDisplayName } from "./sql_ls_helper";
import { uuidv4 } from "./util";
import { MapReduceScope } from "./mr_scope";

export class IdentifierScope {
    uuid = uuidv4();

    tableIdentifierMap: Map<string, ParserRuleContext> = new Map();

    referenceMap: Map<string, ParserRuleContext[]> = new Map();

    referenceNotFound: Map<string, ParserRuleContext[]> = new Map();

    defaultIdentifier: ParserRuleContext | null = null;

    children: IdentifierScope[] = [];

    highlightRanges: { start: number; end: number; type: string }[] = [];

    mrScope: MapReduceScope | null = null;
    
    constructor(
        public context: ParserRuleContext,
        public parent: IdentifierScope | null = null
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
        const newScope = new IdentifierScope(context, this);
        this.children.push(newScope);
        return newScope;
    }

    exitScope() {
        if (this.parent) {
            const parent = this.parent;
            // 清理references
            this.referenceMap.forEach((refs, name) => {
                if (!this.tableIdentifierMap.has(name)) {
                    this.referenceMap.delete(name);
                    refs.forEach(ref => {
                        parent.addReference(name, ref);
                    });
                } else {
                    const identifier = this.tableIdentifierMap.get(name);
                    this.referenceMap.set(name, refs.filter(ref => ref !== identifier));
                }
            });

            return this.parent;
        }

        this.referenceMap.forEach((refs, name) => {
            if (!this.tableIdentifierMap.has(name)) {
                this.referenceNotFound.set(name, refs);
                this.referenceMap.delete(name);
            } else {
                const identifier = this.tableIdentifierMap.get(name);
                this.referenceMap.set(name, refs.filter(ref => ref !== identifier));
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
        return posInRange(position, this.range);
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

    addHighlight(range: { start: number; end: number; type: string }) {
        if (range.start === range.end) {
            throw new Error(`Highlight ranges should not have zero length: ${JSON.stringify(range)}`);
        }
        this.highlightRanges.push(range);
    }

    addHighlightNode(node: ParserRuleContext) {
        console.log('Adding highlight node:', node);
        this.addHighlight({
            start: node.start?.start || 0,
            end: (node.stop?.stop || 0) + 1,
            type: ruleIndexToDisplayName(node) || ''
        });
    }

    getHighlights(ret: {
        start: number;
        end: number;
        type: string;
    }[] = []) {
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

    validate() {
        const errors: {
            message: string;
            context: ParserRuleContext;
            level: 'error' | 'warning';
        }[] = [];
        this.children.forEach(child => {
            errors.push(...child.validate());
        });

        if (this.mrScope) {
            const mrErrors = this.mrScope.validate();
            mrErrors.forEach(err => {
                errors.push({
                    ...err,
                    context: this.context
                });
            });
        }
        return errors;
    }
}
