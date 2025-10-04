export const localDbId = 'local db';


export enum ErrorType {
    DuplicateColumn = 'duplicate_column',
    MustSpecificTable = 'must_specific_table',
    DuplicateTable = 'duplicate_table',
    ColumnNotInGroupBy = 'column_not_in_group_by',
    OrphanTableDef = 'orphan_table_def',
    RefNotFound = 'ref_not_found',
    UnsupportedFeature = 'unsupported_feature',
}

export enum CommandId {
    CopyTestSql = 'hiveSql.copyTestSql',
}

export const CommandLabel: Record<CommandId, string> = {
    [CommandId.CopyTestSql]: 'Copy test sql',
};

// the value from export { LanguageIdEnum } from 'monaco-sql-languages';
export enum LanguageIdEnum {
    HIVE = "hivesql",
}

export const subqueryPlaceHolder = '< subquery >';