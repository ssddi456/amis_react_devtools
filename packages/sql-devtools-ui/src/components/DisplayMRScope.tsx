import React from 'react';
import { createPortal } from 'react-dom';
import { ParseTree } from 'antlr4ng';
import { printNode } from '@amis-devtools/sql-language-service/src/helpers/log';
import { MapReduceScope } from '@amis-devtools/sql-language-service/src/mr_scope';
import { getFormattedSqlFromNode } from '@amis-devtools/sql-language-service/src/helpers/formater';
import { TextHighlight } from './text_highlight';
import { copyToClipboard } from '../tools/copy';
import { subqueryPlaceHolder } from '@amis-devtools/sql-language-service/src/consts';

interface DisplayMRScopeProps {
    mrScope: MapReduceScope;
    showDebug?: boolean;
}

interface ContextMenuState {
    isVisible: boolean;
    x: number;
    y: number;
    showDebug: boolean;
    targetNode: ParseTree | null;
    sql: string;
    refSql: string;
}

export class DisplayMRScope extends React.Component<DisplayMRScopeProps, ContextMenuState> {
    constructor(props: DisplayMRScopeProps) {
        super(props);
        const refNode = props.mrScope.getPosRefNode();
        const refSql = refNode ? (getFormattedSqlFromNode(refNode).split('\n')[0] + ' ...') : '';
        this.state = {
            isVisible: false,
            x: 0,
            y: 0,
            showDebug: props.showDebug ?? false,
            targetNode: props.mrScope.context,
            sql: props.mrScope.context
                ? getFormattedSqlFromNode(props.mrScope.context, {
                    hideSubQuery: true,
                })
                : '',
            refSql,
        };
    }

    componentDidMount() {
        document.addEventListener('click', this.hideContextMenu);
        document.addEventListener('contextmenu', this.hideContextMenu);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.hideContextMenu);
        document.removeEventListener('contextmenu', this.hideContextMenu);
    }

    hideContextMenu = () => {
        this.setState({ isVisible: false });
    };

    showContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setTimeout(() => {
            this.setState({
                isVisible: true,
                x: event.clientX,
                y: event.clientY,
            });
        }, 0);
    };

    copyFormattedSql = async () => {
        try {
            const mrScope = this.props.mrScope;
            const node = mrScope.getDebugNode();
            console.log('copyFormattedSql node', node);

            const sql = node ? getFormattedSqlFromNode(node) : '';
            await copyToClipboard(sql);
        } catch (error) {
            console.error('Error formatting SQL:', error);
        }
        this.hideContextMenu();
    };

    renderNodeWithContextMenu = (node: ParseTree, content: React.ReactNode) => {
        return (
            <span
                style={{ cursor: 'context-menu' }}
            >
                {content}
            </span>
        );
    };

    renderInputTables = (mrScope: MapReduceScope) => {
        const inputTableKeys = Array.from(mrScope.inputTable.keys());
        if (inputTableKeys.length === 0) {
            return null;
        }

        return (
            <>
                <div>inputTable</div>
                {inputTableKeys.map(name => {
                    const inputTable = mrScope.inputTable.get(name);
                    if (!inputTable) {
                        return null;
                    }
                    return (
                        <div key={name} style={{ paddingLeft: 12 }}>
                            {name} -&gt; {printNode(inputTable!.reference)}
                        </div>
                    );
                })}
            </>
        );
    };

    renderTableDefinitions = (mrScope: MapReduceScope) => {
        const tableDefinitionsKeys = Array.from(mrScope.tableDefinitions.keys());
        if (tableDefinitionsKeys.length === 0) {
            return null;
        }

        return (
            <>
                <div>tableDefinitions</div>
                {tableDefinitionsKeys.map(name => {
                    const tableDef = mrScope.tableDefinitions.get(name);
                    if (!tableDef) {
                        return null;
                    }
                    return (
                        <div key={name} style={{ paddingLeft: 12 }}>
                            {name} -&gt; {printNode(tableDef!.reference)}
                        </div>
                    );
                })}
            </>
        );
    };

    renderExportColumns = (mrScope: MapReduceScope) => {
        const exportColumns = mrScope.exportColumns;
        if (exportColumns.length === 0) {
            return null;
        }

        return (
            <>
                <div>exportColumns</div>
                {exportColumns.map((col, i) => (
                    <div key={i} style={{ paddingLeft: 12 }}>
                        {col.exportColumnName} -&gt; {col.referenceTableName || mrScope.getDefaultInputTableName()} . {col.referenceColumnName}
                    </div>
                ))}
            </>
        );
    };

    renderTableReferences = (mrScope: MapReduceScope) => {
        const tableReferenceKeys = Array.from(mrScope.tableReferences.keys());
        if (tableReferenceKeys.length === 0) {
            return null;
        }

        return (
            <>
                <div>tableReferences</div>
                {tableReferenceKeys.map(name => (
                    <div key={name}>
                        <div key={name} style={{ paddingLeft: 12 }}>
                            {name}
                        </div>
                        <div style={{ paddingLeft: 24 }}>
                            {Array.from(mrScope.tableReferences.get(name) || []).map((col, i) => (
                                <div key={i}>
                                    {this.renderNodeWithContextMenu(col, printNode(col))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </>
        );
    };

    renderContextMenu = () => {
        if (!this.state.isVisible) {
            return null;
        }

        return createPortal(
            <div
                style={{
                    position: 'fixed',
                    top: this.state.y,
                    left: this.state.x,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '150px'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div
                    style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee'
                    }}
                    onClick={this.copyFormattedSql}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                >
                    Copy SQL from node
                </div>
            </div>,
            document.body
        );
    };

    renderSql() {
        const sql = this.state.sql || '';
        return (
            
            <pre
                style={{ overflowX: 'auto', maxWidth: '100%' }}
            >
                <TextHighlight
                    text={sql}
                    keywords={[{ match: subqueryPlaceHolder, type: 'subquery' }]}
                />
            </pre>
        );
    }

    render() {
        const { mrScope } = this.props;
        const { refSql } = this.state;
        const cteName = mrScope.getCteName();
        const subQueryAlias = mrScope.getSubQueryAlias();

        return (
            <div onContextMenu={(e) => this.showContextMenu(e)}>
                <div>
                    {cteName ? <span>[CTE: {cteName}]</span> : null}
                    {subQueryAlias ? <span>[subquery: {subQueryAlias}]</span> : null}
                </div>
                {
                    refSql
                        ? (
                            <div
                                style={{ fontSize: 12, color: '#888', marginBottom: 8, fontStyle: 'italic' }}
                            >
                                <i>{refSql}</i>
                            </div>
                        )
                        : null
                }
                {
                    this.state.showDebug
                        ? (
                            <>
                                <div>MapReduce Scope [{mrScope.mrOrder}]</div>
                                <div>{printNode(mrScope.getDisplayContext())}</div>
                                <div>id: {mrScope.id}</div>
                                <div>
                                    {this.renderInputTables(mrScope)}
                                    {this.renderTableDefinitions(mrScope)}
                                    {this.renderExportColumns(mrScope)}
                                    {this.renderTableReferences(mrScope)}
                                </div>
                            </>
                        )
                        : null
                }
                {this.renderSql()}
                {this.renderContextMenu()}
            </div>
        );
    }
}
