import React from 'react';
import { jsxDEV } from "react/jsx-dev-runtime";
import { render } from 'react-dom';
import { render as amisRender, SchemaRenderer } from 'amis';
import { makeEnv } from './tools/amis';
import amisEditor from "./amis_editor";
import 'amis/lib/themes/default.css'
import 'amis/lib/helper.css'
import { ClickToComponent } from 'click-to-react-component';
import { sqlTest } from './cases';
import createSqlEditor from './sql_editor';
import { SqlTestNavigation } from './components/sql_test_navigation';
import { SqlTestVis } from './components/sql_test_vis';
import { SqlTestDag } from './components/sql_test_dag';

const AppComponent = amisRender(
  {
    type: "page",
    data: {
      json_schema: `{
  "type": "hbox",
  "columns": []
}`,
      hive_sql: sqlTest.map((x, index) => '-- case' + (index + 1) + '\n' + x.model.getValue()).join('\n\n'),
    },
    body: [
      "control + click or option + click to go to source",
      {
        type: 'hbox',
        columns: [
          {
            type: 'tpl',
            tpl: 'w-xs',
            className: 'bg-info',
            inline: false,
            columnClassName: 'w-xs',
          },
          {
            type: 'tpl',
            tpl: 'w-sm',
            className: 'bg-info lter',
            inline: false,
            columnClassName: 'w-sm'
          },
          {
            type: 'tpl',
            tpl: 'w',
            className: 'bg-info dk',
            inline: false,
            columnClassName: 'w'
          },
          {
            type: 'tpl',
            tpl: '平均分配',
            className: 'bg-success',
            inline: false
          },
          {
            type: 'tpl',
            tpl: '平均分配',
            className: 'bg-primary',
            inline: false
          },

        ]
      },
      amisEditor,
      createSqlEditor('hive_sql'),
    ]
  },
  {},
  makeEnv({
    SchemaRenderer: (props) => {

      if (props?.schema?.__source) {
        return jsxDEV(SchemaRenderer, { ...props }, void 0, false, props?.schema?.__source, undefined);
      }

      return <SchemaRenderer
        {...props}
      />
    }
  })
);

const App = () => {
  const [sqlTestIdx, setSqlTestIdx] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<'context' | 'dag'>('context');

  return (
    <div className="container">
      <ClickToComponent />
      {/* {AppComponent} */}
      {/*
       */}
      <div style={{ margin: 16, borderBottom: '1px solid #e1e1e1' }}>
        <SqlTestNavigation
          sqlTest={sqlTest}
          onChange={setSqlTestIdx}
        />
      </div>
      <div
        style={{ margin: 16, height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flex: 0 }}>
          <button
            onClick={() => setViewMode('context')}
            style={{
              padding: '8px 16px',
              border: '1px solid #0078d4',
              backgroundColor: viewMode === 'context' ? '#0078d4' : 'white',
              color: viewMode === 'context' ? 'white' : '#0078d4',
              borderTopLeftRadius: 4,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Context View
          </button>
          <button
            onClick={() => setViewMode('dag')}
            style={{
              padding: '8px 16px',
              border: '1px solid #0078d4',
              backgroundColor: viewMode === 'dag' ? '#0078d4' : 'white',
              color: viewMode === 'dag' ? 'white' : '#0078d4',
              borderTopRightRadius: 4,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            DAG View
          </button>
        </div>
          {viewMode === 'context' ? (
            <SqlTestVis
              sqlTest={sqlTest[sqlTestIdx].model.getValue()}
            />
          ) : (
            <SqlTestDag
              sqlTest={sqlTest[sqlTestIdx].model.getValue()}
            />
          )}
      </div>
    </div>
  );
}


const root = document.querySelector('#root');
if (root) {
  render(<App />, root);
}