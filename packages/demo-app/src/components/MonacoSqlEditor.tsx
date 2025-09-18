import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { registerHivesqlLs } from '@amis-devtools/sql-language-service/src/register_ls';
import { LanguageIdEnum } from '@amis-devtools/sql-language-service/src/consts';
import { copyToClipboard } from '@amis-devtools/sql-devtools-ui/src/tools/copy';

interface MonacoSqlEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  readOnly?: boolean;
}

export const MonacoSqlEditor: React.FC<MonacoSqlEditorProps> = ({
  value = '',
  onChange,
  height = 400,
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (editorRef.current && !monacoEditorRef.current) {
      // Create Monaco editor instance
      const editor = monaco.editor.create(editorRef.current, {
        value: value,
        language: LanguageIdEnum.HIVE,
        theme: 'vs-dark',
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

      // Register Hive SQL language service
      const registerLs = registerHivesqlLs({
        tableSourceManager: {
            getTableInfoByName: () => {
                // Mock implementation, replace with actual logic to fetch table info
                return null;
            }
        },
        onCopyToClipboard: (text: string) => {
          return copyToClipboard(text);
        }
      });

      // Apply language service to editor
      if (registerLs && typeof registerLs === 'function') {
        registerLs(editor, monaco);
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
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoEditorRef.current && isInitialized) {
      const currentValue = monacoEditorRef.current.getValue();
      if (currentValue !== value) {
        monacoEditorRef.current.setValue(value);
      }
    }
  }, [value, isInitialized]);

  return (
    <div 
      ref={editorRef} 
      style={{ 
        height: `${height}px`, 
        width: '100%',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden'
      }} 
    />
  );
};
