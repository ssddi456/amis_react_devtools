import React from 'react';
import { jsxDEV } from "react/jsx-dev-runtime";
import { render } from 'react-dom';
import { render as amisRender, SchemaRenderer } from 'amis';
import { makeEnv } from './helper';

const AppComponent = amisRender(
  {
    type: 'hbox',
    _source: {
      fileName: 'demo/index.tsx',
      lineNumber: 1,
      columnNumber: 1
    },
    columns: [
      {
        type: 'tpl',
        tpl: 'w-xs',
        className: 'bg-info',
        inline: false,
        columnClassName: 'w-xs',
        __source: {
          fileName: "E:\\projects\\amis_devtools\\demo\\index.tsx",
          lineNumber: 21,
          columnNumber: 10
        }
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
      }
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


const root = document.querySelector('#root');
if (root) {
  render(AppComponent, root);
}