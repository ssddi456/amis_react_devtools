import React from 'react';
import { printNode } from '../sql_ls/helpers/log';
import { MapReduceScope } from '../sql_ls/mr_scope';

export class DisplayMRScope extends React.Component<{ mrScope: MapReduceScope; }> {
    render() {
        const { mrScope } = this.props;

        const inputTableKeys = Array.from(mrScope.inputTable.keys());
        const tableDefinitionsKeys = Array.from(mrScope.tableDefinitions.keys());
        const exportColumns = mrScope.exportColumns;
        const tableReferenceKeys = Array.from(mrScope.tableReferences.keys());

        return (
            <div>
                <div>MapReduce Scope [{mrScope.mrOrder}]</div>
                <div>id: {mrScope.id}</div>
                <div>{printNode(mrScope.context)}</div>
                <div>
                    {inputTableKeys.length !== 0 ? <div>inputTable</div> : null}
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
                    {tableDefinitionsKeys.length !== 0 ? <div>tableDefinitions</div> : null}
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
                    {exportColumns.length !== 0 ? <div>exportColumns</div> : null}
                    {exportColumns.map((col, i) => (
                        <div key={i} style={{ paddingLeft: 12 }}>
                            {col.exportColumnName} -&gt; {col.referanceTableName || mrScope.getDefaultInputTableName()} . {col.referanceColumnName}
                        </div>
                    ))}
                    {tableReferenceKeys.length !== 0 ? <div>tableReferences</div> : null}
                    {tableReferenceKeys.map(name => (
                        <div key={name}>
                            <div key={name} style={{ paddingLeft: 12 }}>
                                {name}
                            </div>
                            <div style={{ paddingLeft: 24 }}>
                                {Array.from(mrScope.tableReferences.get(name) || []).map((col, i) => (
                                    <div key={i}>
                                        {printNode(col)}
                                    </div>
                                ))}
                            </div>
                        </div>

                    ))}
                </div>
            </div>
        );
    }
}
