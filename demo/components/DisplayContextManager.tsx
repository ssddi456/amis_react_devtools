import React from 'react';
import { printNode } from '../sql_ls/helpers/log';
import { DisplayMRScope } from './DisplayMRScope';
import { IdentifierScope } from '../sql_ls/identifier_scope';

interface DisplayContextManagerProps {
    context: IdentifierScope
}

export class DisplayContextManager extends React.Component<DisplayContextManagerProps> {
    render() {
        const context = this.props.context;
        const mrScope = context.mrScope;
        const tableIdentifierMap = Array.from(context.tableIdentifierMap.keys());
        const tableCount = tableIdentifierMap.length;
        const referenceMap = Array.from(context.referenceMap.keys());
        const referenceCount = referenceMap.length;
        const referenceNotFound = Array.from(context.referenceNotFound.keys());
        const referenceNotFoundCount = referenceNotFound.length;
        const highlights = context.highlightRanges;

        return (
            <>
                <div
                    style={{
                        marginTop: 2,
                        display: 'flex',
                        padding: 4,
                        gap: 4,
                        background: '#f0f0f0',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                        }}
                    >
                        <div
                            style={{ borderBottom: '1px solid #ccc', marginBottom: 4 }}
                        >
                            {printNode(context.context)} (c: {context.children.length})
                        </div>
                        {tableCount ? <div>tableIdentifierMap</div> : null}
                        {tableIdentifierMap.map((table) => {
                            return (
                                <div
                                    key={table}
                                    style={{
                                        paddingLeft: 12,
                                    }}
                                >
                                    {table}
                                </div>
                            );
                        })}
                        {referenceCount ? <div>referenceMap</div> : null}
                        {referenceMap.map((name) => {
                            return (
                                <div key={name} style={{ paddingLeft: 12 }}>
                                    {name}
                                </div>
                            );
                        })}
                        {referenceNotFoundCount ? <div>referenceNotFound</div> : null}
                        {referenceNotFound.map((name) => {
                            return (
                                <div key={name} style={{ paddingLeft: 12 }}>
                                    {name}
                                </div>
                            );
                        })}
                        {highlights.length ? <div>highlights</div> : null}
                        {highlights.map((range, i) => {
                            return (
                                <div key={i} style={{ paddingLeft: 12 }}>
                                    {printNode(range.context)}
                                </div>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            flex: 1,
                            paddingLeft: 4,
                            borderLeft: '1px solid #ccc',
                        }}
                    >
                        {mrScope && <DisplayMRScope mrScope={mrScope} />}
                    </div>
                </div>
                {context.children.length > 0
                    ? (
                        <div
                            style={{
                                marginLeft: 18,
                                marginTop: 4
                            }}
                        >
                            {context.children.map(x => {
                                return (
                                    <DisplayContextManager key={x.uuid} context={x} />
                                );
                            })}
                        </div>
                    )
                    : null}
            </>
        );
    }
}
