# SQL Development Helper - Demo App

A free-to-use SQL development helper and usage example built with components from `@amis-devtools/sql-devtools-ui`.

## Features

### 🔧 SQL Editor View
- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting
- **Hive SQL Language Service**: Intelligent SQL support with:
  - Auto-completion for tables and columns
  - Error detection and validation
  - Go to definition support
  - Reference finding
  - Hover information
  - Code formatting

### 🔍 Symbol Table View
- **Context View**: Display and analyze SQL symbols including:
  - CTEs (Common Table Expressions)
  - SELECT statements
  - Column references
  - Foreign table relationships
- **DAG View**: Interactive directed acyclic graph visualization

### 🌐 CTE Graph View
- **Interactive Visualization**: Node-based graph showing:
  - Table dependency relationships
  - CTE flow and dependencies
  - Zoom and pan controls
  - Node selection and highlighting

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3031`

## Usage

1. **SQL Editor Tab**: Write and edit SQL queries with full language service support
2. **Symbol Table Tab**: Analyze the structure and relationships in your SQL
3. **CTE Graph Tab**: Visualize table dependencies and CTE flows

## Example SQL Queries

The demo includes several example SQL queries demonstrating:
- Basic SELECT statements
- JOIN operations
- Common Table Expressions (CTEs)
- Subqueries
- UNION operations
- Complex nested queries

## Architecture

This demo app showcases how to integrate:
- `@amis-devtools/sql-devtools-ui` - UI components for SQL development
- `@amis-devtools/sql-language-service` - Language service for SQL intelligence
- `monaco-editor` - Code editor component
- `monaco-sql-languages` - SQL language support for Monaco

## Related Packages

- [`@amis-devtools/sql-devtools-ui`](../sql-devtools-ui) - Source UI components
- [`@amis-devtools/sql-language-service`](../sql-language-service) - SQL language service implementation

## Contributing

This is a demonstration application. For contributions to the core functionality, please see the respective packages in the monorepo.

## License

This project is part of the amis-devtools monorepo.
