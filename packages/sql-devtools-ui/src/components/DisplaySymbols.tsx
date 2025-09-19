import React, { useCallback } from 'react';
import { Id_Context } from 'dt-sql-parser/dist/lib/hive/HiveSqlParser';
import { ContextManager } from '@amis-devtools/sql-language-service/src/context_manager';
import { ruleIndexToDisplayName } from '@amis-devtools/sql-language-service/src/helpers/log';
import { SymbolAndContext } from '@amis-devtools/sql-language-service/src/identifier_scope';
import { isTableReferenceContext } from '@amis-devtools/sql-language-service/src/helpers/util';

interface DisplaySymbolsProps {
    contextManager: ContextManager;
    onNodeClick?: (symbol: SymbolAndContext) => void;
}

interface FilteredSymbol extends SymbolAndContext {
    parentType: string;
    position: string;
}

export function DisplaySymbols({ contextManager, onNodeClick }: DisplaySymbolsProps): JSX.Element {
    const symbols = contextManager.getSymbolsAndContext();
    
    // Filter symbols where range.context is Id_Context and prepare display data
    const filteredSymbols: FilteredSymbol[] = symbols
        .filter(symbol => symbol.range.context instanceof Id_Context)
        .map(symbol => {
            if (!symbol.range.context || !symbol.range.context.parent) {
                return null;
            }

            if (!isTableReferenceContext(symbol.range.context.parent)) {
                return null;
            }

            const parentType = ruleIndexToDisplayName(symbol.range.context.parent);
            
            const position = `${symbol.range.lineNumber}:${symbol.range.column}`;
            
            return {
                ...symbol,
                parentType,
                position,
            };
        })
        .filter((s): s is FilteredSymbol => s !== null); // Type guard to remove nulls

    const handleSymbolClick = useCallback((symbol: FilteredSymbol) => {
        onNodeClick?.(symbol);
    }, [onNodeClick]);

    return (
        <div style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
                Symbols ({filteredSymbols.length})
            </h3>
            
            {filteredSymbols.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                    No table symbols found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredSymbols.map((symbol, index) => {
                        const text = symbol.range.context.getText();
                        
                        return (
                            <div
                                key={index}
                                onClick={() => handleSymbolClick(symbol)}
                                style={{
                                    padding: '6px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: '#f9f9f9',
                                    cursor: onNodeClick ? 'pointer' : 'default',
                                    transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    if (onNodeClick) {
                                        e.currentTarget.style.backgroundColor = '#e6f3ff';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (onNodeClick) {
                                        e.currentTarget.style.backgroundColor = '#f9f9f9';
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <span
                                            style={{ 
                                                fontWeight: 'bold',
                                                color: '#0066cc',
                                                maxWidth: '120px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                            title={text}
                                        >
                                            {text}
                                        </span>
                                        <span style={{ 
                                            color: '#666',
                                            fontSize: '11px',
                                            backgroundColor: '#e6e6e6',
                                            padding: '2px 4px',
                                            borderRadius: '2px'
                                        }}>
                                            {symbol.parentType}
                                        </span>
                                    </div>
                                    <span style={{ 
                                        color: '#888',
                                        fontSize: '11px'
                                    }}>
                                        {symbol.position}
                                    </span>
                                </div>
                                
                                {/* Additional context info */}
                                <div style={{ 
                                    marginTop: '4px',
                                    fontSize: '10px',
                                    color: '#777',
                                    display: 'flex',
                                    gap: '8px'
                                }}>
                                    <span>@{symbol.range.start}-{symbol.range.end}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
