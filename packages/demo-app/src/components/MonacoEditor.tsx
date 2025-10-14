import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import loader from "@monaco-editor/loader";
import * as Monaco from 'monaco-editor';
import { IRange, type editor } from 'monaco-editor';
import { envSetup, registerHivesqlLs } from '@amis-devtools/sql-language-service/src/register_ls';
import { LanguageIdEnum } from '@amis-devtools/sql-language-service/src/consts';
import { copyToClipboard } from '@amis-devtools/sql-devtools-ui/src/tools/copy';
import { customActionRunHandler, ITableSourceManager } from '@amis-devtools/sql-language-service/src/types';
import { registerJsonLs } from './jsonLs';

// 导航历史类型定义
interface NavigationPosition {
  selection: IRange;
  revealPosition: {
    lineNumber: number;
    column: number;
  };
  timestamp: number;
}

// 导航历史管理器
class NavigationHistory {
  private history: NavigationPosition[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 20;
  private isNavigating: boolean = false; // 防止在导航时记录新位置

  addPosition(position: NavigationPosition): void {
    if (this.isNavigating) {
      return;
    }

    // 如果当前不在历史末尾，删除当前位置之后的所有记录
    if (this.currentIndex < this.history.length - 1) {
      this.history.splice(this.currentIndex + 1);
    }

    // 避免重复记录相同位置
    const lastPosition = this.history[this.history.length - 1];
    if (lastPosition && this.isSamePosition(lastPosition, position)) {
      return;
    }

    this.history.push(position);
    this.currentIndex = this.history.length - 1;

    // 保持历史记录大小在限制内
    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  goBack(): NavigationPosition | null {
    if (this.canGoBack()) {
      this.currentIndex--;
      this.isNavigating = true;
      return this.history[this.currentIndex];
    }
    return null;
  }

  goForward(): NavigationPosition | null {
    if (this.canGoForward()) {
      this.currentIndex++;
      this.isNavigating = true;
      return this.history[this.currentIndex];
    }
    return null;
  }

  setNavigatingFlag(flag: boolean): void {
    this.isNavigating = flag;
  }

  clearForwardHistory(): void {
    if (this.currentIndex < this.history.length - 1) {
      this.history.splice(this.currentIndex + 1);
    }
  }

  private isSamePosition(pos1: NavigationPosition, pos2: NavigationPosition): boolean {
    const sel1 = pos1.selection;
    const sel2 = pos2.selection;
    return (
      sel1.startLineNumber === sel2.startLineNumber &&
      sel1.startColumn === sel2.startColumn &&
      sel1.endLineNumber === sel2.endLineNumber &&
      sel1.endColumn === sel2.endColumn
    );
  }
}
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
  navigateBack: () => boolean;
  navigateForward: () => boolean;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
}

enum osEnum {
  Mac = 'Mac',
  Windows = 'Windows',
  Other = 'Other'
}

function checkOS() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.match('macintosh') || userAgent.match('mac os x')) {
    return osEnum.Mac;
  } else if (userAgent.match('windows nt') || userAgent.match('win32') || userAgent.match('win64')) {
    return osEnum.Windows;
  } else {
    return osEnum.Other;
  }
}

const platform: osEnum = checkOS();
console.log('platform:', platform);

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

  // 导航历史管理
  const navigationHistoryRef = useRef<NavigationHistory>(new NavigationHistory());
  const lastSelectionTimeRef = useRef<number>(0);

  // 记录光标位置的函数
  const recordCursorPosition = useCallback((editor: editor.IStandaloneCodeEditor, selection: any) => {
    const now = Date.now();
    // 防止过于频繁的记录，至少间隔100ms
    if (now - lastSelectionTimeRef.current < 100) {
      return;
    }
    lastSelectionTimeRef.current = now;

    const position: NavigationPosition = {
      selection: {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn,
      },
      revealPosition: {
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      },
      timestamp: now,
    };

    navigationHistoryRef.current.addPosition(position);
  }, []);

  // 导航函数
  const navigateBack = useCallback((): boolean => {
    const editor = monacoEditorRef.current;
    if (!editor) return false;

    const position = navigationHistoryRef.current.goBack();
    if (position) {
      editor.setSelection(position.selection);
      editor.revealPositionInCenter(position.revealPosition);

      // 短暂延迟后重置导航标志
      setTimeout(() => {
        navigationHistoryRef.current.setNavigatingFlag(false);
      }, 50);

      return true;
    }
    return false;
  }, []);

  const navigateForward = useCallback((): boolean => {
    const editor = monacoEditorRef.current;
    if (!editor) return false;

    const position = navigationHistoryRef.current.goForward();
    if (position) {
      editor.setSelection(position.selection);
      editor.revealPositionInCenter(position.revealPosition);

      // 短暂延迟后重置导航标志
      setTimeout(() => {
        navigationHistoryRef.current.setNavigatingFlag(false);
      }, 50);

      return true;
    }
    return false;
  }, []);

  const canNavigateBack = useCallback((): boolean => {
    return navigationHistoryRef.current.canGoBack();
  }, []);

  const canNavigateForward = useCallback((): boolean => {
    return navigationHistoryRef.current.canGoForward();
  }, []);

  // Expose the Monaco editor instance and navigation methods through the ref
  useImperativeHandle(ref, () => ({
    getEditor: () => monacoEditorRef.current,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward,
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

      // 注册导航命令
      const navigateBackAction = editor.addAction({
        id: 'navigate-back',
        label: '后退',
        keybindings: {
          [osEnum.Windows]: [
            monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
          ],
          [osEnum.Mac]: [
            monaco.KeyMod.WinCtrl | monaco.KeyCode.Minus,
          ],
          [osEnum.Other]: [
            monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
          ],
        }[platform],
        run: () => {
          navigateBack();
        },
      });

      const navigateForwardAction = editor.addAction({
        id: 'navigate-forward',
        label: '前进',
        keybindings: {
          [osEnum.Windows]: [
            monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
          ],
          [osEnum.Mac]: [
            monaco.KeyMod.WinCtrl | monaco.KeyMod.Shift | monaco.KeyCode.Minus,
          ],
          [osEnum.Other]: [
            monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
          ],
        }[platform],
        run: () => {
          navigateForward();
        },
      });

      // 监听光标选择变化事件
      const selectionChangeSubscription = editor.onDidChangeCursorSelection((e) => {
        recordCursorPosition(editor, e.selection);
      });

      // 监听内容变化事件，当发生编辑时清除前进历史
      const contentChangeSubscription = editor.onDidChangeModelContent(() => {
        // 清除前进历史
        navigationHistoryRef.current.clearForwardHistory();

        // 处理value change回调
        const currentValue = editor.getValue();
        if (onChange) {
          onChange(currentValue);
        }
      });

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

      setIsInitialized(true);

      // Cleanup function
      return () => {
        selectionChangeSubscription.dispose();
        contentChangeSubscription.dispose();
        navigateBackAction.dispose();
        navigateForwardAction.dispose();
        editor.dispose();
        monacoEditorRef.current = null;
      };
    }
  }, [editorRef.current, monaco, recordCursorPosition, navigateBack, navigateForward]);

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
