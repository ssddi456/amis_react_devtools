import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import loader from "@monaco-editor/loader";
import * as Monaco from 'monaco-editor';
import { type editor } from 'monaco-editor';
import { envSetup, registerHivesqlLs } from '@amis-devtools/sql-language-service/src/register_ls';
import { LanguageIdEnum } from '@amis-devtools/sql-language-service/src/consts';
import { copyToClipboard } from '@amis-devtools/sql-devtools-ui/src/tools/copy';
import { customActionRunHandler, ITableSourceManager } from '@amis-devtools/sql-language-service/src/types';
import { registerJsonLs } from './jsonLs';
interface MonacoEditorProps {
  language: string,
  tableSourceManager?: ITableSourceManager;
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  onValidate?: (errors: editor.IMarkerData[]) => void;
  customActions?: {
    id: string;
    title: string;
    run: customActionRunHandler
  }[];
}

loader.config({
  monaco: Monaco,
  'vs/nls': { availableLanguages: { '*': 'zh-CN' } },
});

loader.init();

export interface MonacoEditorRef {
  getEditor: () => editor.IStandaloneCodeEditor | null;
}


export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(({
  tableSourceManager,
  value = '',
  language,
  onChange,
  readOnly = false,
  onValidate,
  customActions = [],
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [startLanguage] = useState(language);
  const [monaco, setMonacoInitialized] = useState<typeof import("monaco-editor") | null>(null);

  // Expose the Monaco editor instance through the ref
  useImperativeHandle(ref, () => ({
    getEditor: () => monacoEditorRef.current,
  }));

  useEffect(() => {
    envSetup();
    loader.init().then((monaco) => {
      setMonacoInitialized(monaco);
    });
  }, [])

  useEffect(() => {
    if (editorRef.current && monaco && !monacoEditorRef.current) {
      // Create Monaco editor instance
      const editor = monaco.editor.create(editorRef.current, {
        value: value,
        language: language,
        // theme: 'vs-dark',
        readOnly: readOnly,
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        selectOnLineNumbers: true,
        roundedSelection: false,
        scrollBeyondLastColumn: 5,
        fontSize: 14,
        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      });

      monacoEditorRef.current = editor;

      if (language === LanguageIdEnum.HIVE) {
        if (!tableSourceManager) {
          console.warn('tableSourceManager is required for Hive SQL language service');
        }
        // Register Hive SQL language service
        registerHivesqlLs({
          tableSourceManager: tableSourceManager || { getTableInfoByName: async () => null },
          onCopyToClipboard: (text: string) => {
            return copyToClipboard(text);
          },
          onValidate,
          customActions,
        })(editor, monaco);
      }

      if (language === 'json') {
        registerJsonLs()(editor, monaco);
      }


      // Handle value changes
      const subscription = editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        if (onChange) {
          onChange(currentValue);
        }
      });

      setIsInitialized(true);


      // Cleanup function
      return () => {
        subscription.dispose();
        editor.dispose();
        monacoEditorRef.current = null;
      };
    }
  }, [editorRef.current, monaco]);

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoEditorRef.current && isInitialized) {
      const currentValue = monacoEditorRef.current.getValue();
      if (currentValue !== value) {
        monacoEditorRef.current.setValue(value);
      }
    }
  }, [value, isInitialized]);

  useEffect(() => {
    if (language !== startLanguage) {
      console.warn('Language change is not supported in this editor instance. Please recreate the editor with the new language.');
    }
  }, [language]);



  return (
    <div
      ref={editorRef}
      style={{
        height: '100%',
        width: '100%',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'auto'
      }}
    />
  );
});
