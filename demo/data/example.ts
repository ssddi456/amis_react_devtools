export default [
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
        table_name: "rpr_test_quota_similar_house_region_da",
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
];
