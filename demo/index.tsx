import React from 'react';
import { jsxDEV } from "react/jsx-dev-runtime";
import { render } from 'react-dom';
import { render as amisRender, SchemaRenderer } from 'amis';
import { makeEnv } from './helper';
import editor from "./editor";
import 'amis/lib/themes/default.css'
import 'amis/lib/helper.css'
import { ClickToComponent } from 'click-to-react-component';


(window as any).MonacoEnvironment = {
  getWorker(workerId: string, label:string) {
    if (label === 'json') {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/json/json.worker",
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
}`
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
      editor
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