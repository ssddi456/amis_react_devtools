import React from 'react';
import { jsxDEV } from "react/jsx-dev-runtime";
import { render } from 'react-dom';
import { render as amisRender, SchemaRenderer } from 'amis';
import { makeEnv } from './helper';
import amisEditor from "./amis_editor";
import sqlEditor from "./sql_editor";
import 'amis/lib/themes/default.css'
import 'amis/lib/helper.css'
import { ClickToComponent } from 'click-to-react-component';
import { sqlTest } from './hiveLsTest';
import { DoSqlTest } from "./do_sql_test";


(window as any).MonacoEnvironment = {
  getWorker(workerId: string, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/json/json.worker",
          import.meta.url
        )
      );
    }
    if (label === 'hivesql') {
      return new Worker(
        new URL(
          "monaco-sql-languages/esm/languages/hive/hive.worker",
          import.meta.url
        )
      );
    }
    return null;
  }
}

const AppComponent = amisRender(
  {
    type: "page",
    data: {
      json_schema: `{
  "type": "hbox",
  "columns": []
}`,
      hive_sql: sqlTest.map(x => x.model.getValue()).join('\n\n'),
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
      sqlEditor,
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

const localStorageKey = 'amis_react_devtools_demo_index';
const App = () => {
  const [caseIndex, setCaseIndex] = React.useState(
    localStorage.getItem(localStorageKey) ? parseInt(localStorage.getItem(localStorageKey)!) : 0
  );

  const maxIndex = sqlTest.length - 1;
  const changeCase = (index: number) => {
    setCaseIndex(Math.max(0, Math.min(maxIndex, index)));
    localStorage.setItem(localStorageKey, String(index));
  };

  return (
    <div className="container">
      <ClickToComponent />
      {AppComponent}
      <div style={{ margin: '10px 0' }}>
        <div>
          <button
            onClick={() => changeCase(caseIndex - 1)}
            disabled={caseIndex <= 0}
          >
            Previous
          </button>
          <span style={{ margin: '0 10px' }}>
            Case {caseIndex + 1} of {maxIndex + 1}
          </span>
          <button
            onClick={() => changeCase(caseIndex + 1)}
            disabled={caseIndex >= maxIndex}
          >
            Next
          </button>
          <a href='https://dtstack.github.io/monaco-sql-languages/' target='_blank' rel='noopener noreferrer'>ast parser</a>
        </div>
        <DoSqlTest case={sqlTest[caseIndex]} key={caseIndex} />
      </div>
    </div>
  );
}


const root = document.querySelector('#root');
if (root) {
  render(<App />, root);
}