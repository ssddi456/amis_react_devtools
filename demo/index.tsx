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
      hive_sql: [
        // simple
        `select * from data_test_news_record_di where pt = 1;`,
        `select * from data.data_test_news_record_di where pt = 1;`,
        // simple with alias
        `select
  field_2, t.test
from data_test_news_record_da t
where pt = 2;`,

        `select
  t.field_2, t.test,
  count(*) as cnt
from data.data_test_news_record_da t
where pt = 2
group by
  t.field_2, t.test
;`,
        `select
  t1.house_code, t1.resblock_id, t2.quota_date
from data.data_test_news_record_di t1
  left join data.data_test_quota_similar_house_region_da t2
  on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
where t1.pt = 2;`,

].join('\n\n'),
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

const App = () => {
  return (
    <div className="container">
      <ClickToComponent />
      {AppComponent}
    </div>
  );
}


const root = document.querySelector('#root');
if (root) {
  render(<App />, root);
}