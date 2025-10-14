---
applyTo: "packages/demo-app/src/**/*.ts,packages/demo-app/src/**/*.tsx"
---

目录结构

# Demo App 开发文档

```tree

## 项目概述

```
Demo App 是一个基于 React 和 Monaco Editor 的 SQL 开发工具演示应用，集成了 SQL 语言服务、语法高亮、智能提示、代码导航等功能。该应用主要用于演示 @amis-devtools/sql-language-service 和 @amis-devtools/sql-devtools-ui 的核心功能。

## 目录结构

```tree
packages/demo-app/src/
├── App.tsx                    # 主应用组件
├── index.tsx                  # 应用入口文件
├── sqlTest.tsx                # SQL测试用例和表格数据源管理
├── styles.css                 # 全局样式定义
├── components/                # 组件目录
│   ├── MonacoEditor.tsx       # Monaco编辑器封装组件
│   ├── TabNavigationPanel.tsx # 标签页导航面板组件
│   ├── CustomTableEditor.tsx  # 自定义表格编辑器
│   ├── CustomTableEditor.css  # 自定义表格编辑器样式
│   └── jsonLs.ts             # JSON语言服务注册
└── template/                  # 模板和工具目录
    ├── index.ejs             # HTML模板
    └── storage.ts            # 本地存储工具函数
```

## 核心功能模块

### 1. 主应用组件 (App.tsx)

**功能概述：**
- SQL 编辑器的主界面管理
- 多种 SQL 示例的切换和展示
- SQL 语言服务的集成和状态管理
- 与父窗口的通信（支持嵌入式使用）
- 本地存储的 SQL 内容管理

**核心特性：**
- **SQL 示例管理：** 内置多种复杂 SQL 示例，包括 JOIN、CTE、窗口函数等
- **实时语法分析：** 集成 SQL 语言服务，提供实时的语法检查和智能提示
- **图形化分析：** 将 SQL 的依赖关系可视化为节点图
- **跨窗口通信：** 支持作为子窗口嵌入到其他应用中
- **本地持久化：** 自动保存用户编辑的 SQL 内容

**状态管理：**
```typescript
// 主要状态变量
const [showHelper, setShowHelper] = useState(false);           // 辅助面板显示状态
const [activeTab, setActiveTab] = useState<TabType>('graph');   // 当前激活的标签页
const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);    // 选中的SQL示例索引
const [customSql, setCustomSql] = useState(sqlId ? '' : loadSql); // 自定义SQL内容
const [context, setContext] = useState<ContextManager | null>(null); // SQL语言服务上下文
const [errors, setErrors] = useState<editor.IMarkerData[]>([]);     // 语法错误信息
```

### 2. Monaco 编辑器组件 (MonacoEditor.tsx)

**功能概述：**
- Monaco Editor 的 React 封装
- SQL 语言服务的注册和配置
- 导航历史管理
- 自定义操作和快捷键

**核心特性：**
- **语言服务集成：** 支持 Hive SQL 和 JSON 的语法高亮和智能提示
- **导航历史：** 实现类似 IDE 的前进/后退功能
- **自定义操作：** 支持添加自定义的编辑器操作（如跳转到图表视图）
- **代码格式化：** 集成 SQL 代码格式化功能

**导航历史管理：**
```typescript
// 导航历史类，记录用户的编辑位置
class NavigationHistory {
  private history: NavigationPosition[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 20;
  
  // 核心方法
  addPosition(position: NavigationPosition): void;
  goBack(): NavigationPosition | null;
  goForward(): NavigationPosition | null;
}
```

### 3. 标签页导航面板 (TabNavigationPanel.tsx)

**功能概述：**
- 管理多个功能标签页的切换
- 集成各种 SQL 分析和可视化组件
- 提供统一的交互接口

**标签页类型：**
- **symbols：** 符号表显示，展示 SQL 中的所有标识符
- **graph：** 依赖关系图，可视化 SQL 的数据流和依赖
- **validation：** 验证结果，显示语法错误和警告
- **custom_tables：** 自定义表格编辑器，管理测试数据源

### 4. 自定义表格编辑器 (CustomTableEditor.tsx)

**功能概述：**
- 通过 JSON 配置管理数据库表结构
- 支持表格信息的导入/导出
- 实时更新 SQL 语言服务的表信息

**配置格式：**
```json
[
  {
    "db_name": "default",
    "table_name": "users", 
    "description": "用户表",
    "column_list": [
      {
        "column_name": "id",
        "description": "用户ID", 
        "data_type_string": "INT"
      }
    ]
  }
]
```

### 5. SQL 测试用例管理 (sqlTest.tsx)

**功能概述：**
- 预定义的 SQL 示例集合
- 表格数据源管理器实现
- 本地存储的表格信息管理

**内置 SQL 示例：**
- 基础 SELECT 查询
- JOIN 操作演示
- 聚合函数和分组
- 公共表表达式 (CTE)
- 窗口函数应用
- 子查询和 EXISTS
- CASE 语句和字符串函数
- 日期函数处理
- 复杂的多 CTE 分析查询

## 开发规范

### 1. 组件设计原则

**单一职责：** 每个组件专注于特定功能
- `App.tsx`：主应用逻辑和状态管理
- `MonacoEditor.tsx`：编辑器功能封装  
- `TabNavigationPanel.tsx`：界面布局和导航
- `CustomTableEditor.tsx`：表格配置管理

**状态提升：** 共享状态统一在父组件管理
```typescript
// 在 App.tsx 中集中管理核心状态
const [context, setContext] = useState<ContextManager | null>(null);
const [errors, setErrors] = useState<editor.IMarkerData[]>([]);
```

### 2. 类型安全

**严格的类型定义：**
```typescript
// 使用完整的类型定义
type TabType = 'symbols' | 'graph' | 'validation' | 'custom_tables';
interface NavigationPosition {
  selection: IRange;
  revealPosition: { lineNumber: number; column: number; };
  timestamp: number;
}
```

**优先使用指针类型：** 对于对象类型的变量，优先使用指针（引用）而非值传递

## 外部通信协议

### 窗口间通信

**发送就绪消息：**
```typescript
// 子窗口向父窗口发送就绪信号
const readyMessage = { 
  type: 'sql_editor_ready',
  sql_id: sqlId 
};
window.opener.postMessage(readyMessage, '*');
```

**接收配置消息：**
```typescript
// 监听来自父窗口的配置更新
window.addEventListener('message', (event) => {
  if (event.data?.type === 'sql_editor_content_change') {
    setCustomSql(event.data.content);
  }
  if (event.data?.type === 'sql_editor_table_source_change') {
    tableSource.reloadTableInfos(event.data.tableSource);
  }
});
```

### URL 参数支持

**支持的 URL 参数：**
- `sql_id`: 指定特定的 SQL 编辑会话ID，禁用本地存储

**使用示例：**
```javascript
// 在父页面中打开 SQL 编辑器
window.open('http://localhost:3031?sql_id=123', 'sql_editor');
```

## 本地存储策略

### 存储键值

- `custom-tables-sql`: 用户自定义的 SQL 内容
- `custom-tables-config`: 自定义表格配置信息

### 存储工具函数

```typescript
// 通用存储工具 (template/storage.ts)
export function createStorage<T>(
  key: string, 
  load: (s: string) => T, 
  defaultValue: T
) {
  return {
    load: () => T,
    save: (data: string) => void
  };
}
```

## 样式规范

### CSS 模块化

- 全局样式：`styles.css`
- 组件专用样式：`CustomTableEditor.css`
- 第三方样式导入：从 `@amis-devtools/sql-devtools-ui` 导入

### 响应式设计

使用 vh/vw

```css
.demo-app {
  min-height: 100vh;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}

.editor-container {
  display: flex;
  height: 100%;
}
```

## 构建和部署

### 开发命令

```bash
# 开发模式
npm run dev:demo

# 构建生产版本  
npm run compile:extension
```

### 配置文件

- Rspack 配置：`config/rspack.config.js`
- TypeScript 配置：`tsconfig.json`
- HTML 模板：`template/index.ejs`
