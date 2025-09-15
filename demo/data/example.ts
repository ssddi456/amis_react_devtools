import { ITableSourceManager, TableInfo } from "../sql_ls/types";

interface IExampleTableSourceManager extends ITableSourceManager {
    findTableSource(dbName: string, tableName: string): Promise<TableInfo | null>;
    findTableSourcesByName(tableName: string): Promise<TableInfo | null>;
}

const tableSourceManager: IExampleTableSourceManager = {
    async findTableSource(dbName: string, tableName: string): Promise<TableInfo | null> {
        const table = tableInfos.find(t => t.table_name === tableName && t.db_name === dbName);
        return table || null;
    },

    async findTableSourcesByName(tableName: string): Promise<TableInfo | null> {
        const tables = tableInfos.find(t => t.table_name === tableName) || null;
        return tables;
    },

    async getTableInfoByName(
        tableName: string,
        dbName: string | undefined,
    ): Promise<TableInfo | null> {
        if (!tableName) {
            return null;
        }
        if (!dbName && tableName.indexOf('.') !== -1) {
            const parts = tableName.split('.');
            dbName = parts[0];
            tableName = parts[1];
            if (!dbName || !tableName) {
                return null;
            }
        }
        if (dbName) {
            return this.findTableSource(dbName, tableName);
        }
        return this.findTableSourcesByName(tableName);
    }
};

const tableInfos: TableInfo[] = [
    {
        db_name: "rpr",
        table_name: "rpr_test_news_record_di",
        table_id: 1,
        description: "测试表1",
        column_list: [
            {
                column_name: "pt",
                data_type_string: "string",
                description: "分区标识",
            },
            {
                column_name: "house_code",
                data_type_string: "string",
                description: "房源编码",
            },
            {
                column_name: "resblock_id",
                data_type_string: "string",
                description: "小区编码",
            },
            {
                column_name: "resblock_name",
                data_type_string: "string",
                description: "小区名称",
            },
            {
                column_name: "city_id",
                data_type_string: "string",
                description: "城市编码",
            },
            {
                column_name: "news_time",
                data_type_string: "string",
                description: "新闻时间",
            },
            {
                column_name: "news_type",
                data_type_string: "string",
                description: "新闻类型",
            },
            {
                column_name: "extra",
                data_type_string: "string",
                description: "额外信息, json格式",
            },
        ],
    },
    {
        db_name: "rpr",
        table_name: "rpr_test_news_record_da",
        table_id: 2,
        description: "测试表2",
        column_list: [
            {
                column_name: "house_code",
                data_type_string: "string",
                description: "房源编码",
            },
            {
                column_name: "resblock_id",
                data_type_string: "string",
                description: "小区编码",
            },
            {
                column_name: "resblock_name",
                data_type_string: "string",
                description: "",
            },
            {
                column_name: "city_id",
                data_type_string: "string",
                description: "城市编码",
            },
            {
                column_name: "news_time",
                data_type_string: "string",
                description: "新闻时间",
            },
            {
                column_name: "news_type",
                data_type_string: "string",
                description: "新闻类型",
            },
            {
                column_name: "extra",
                data_type_string: "string",
                description: "额外信息, json格式",
            },
            {
                column_name: "pt",
                data_type_string: "string",
                description: "分区标识",
            },
        ],
    },
    {
        db_name: "rpr",
        table_name: "rpr_test_quota_similar_da",
        table_id: 3,
        description: "测试表3",
        column_list: [
            {
                column_name: "pt",
                data_type_string: "string",
                description: "分区标识",
            },
            {
                column_name: "house_code",
                data_type_string: "string",
                description: "房源编码",
            },
            {
                column_name: "resblock_id",
                data_type_string: "string",
                description: "小区编码",
            },
            {
                column_name: "quota_date",
                data_type_string: "bigint",
                description: "小区在售竞品房源数",
            },
        ],
    },
    {
        db_name: 'rpr',
        table_name: 'rpr_news_record_da',
        table_id: 4,
        description: '测试表4',
        column_list: [
            {
                column_name: "house_code",
                data_type_string: "string",
                description: "房源编码",
            },
            {
                column_name: "news_time",
                data_type_string: "string",
                description: "时间",
            },
            {
                column_name: "news_type",
                data_type_string: "string",
                description: "类型",
            },
            {
                column_name: "pt",
                data_type_string: "string",
                description: "分区标识",
            },
        ]
    }
];

export default tableSourceManager;