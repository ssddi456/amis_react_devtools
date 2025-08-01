import { caseFromString } from "./ls_helper";

export const sqlTest = [
    // simple
    `
select * from data_test_news_record_di where pt = 1;
               ^
`,
    `
select * from data.data_test_news_record_di where data.pt = 1;
                ^   ^                               ^   ^
`,
    `
select * from data.data_test_news_record_di where data.pt = 1;
                  ^                                   ^  
`,
  // simple with alias
  // simple with alias
  `select
  field_2, t.test
    ^      ^ ^
from data_test_news_record_da t
      ^
where pt = 2;
      ^
`,
  // simple with alias
  // simple with alias
  `select
  field_2, t.test
    ^
from data_test_news_record_da t
where pt = 2;
`,

    `select
  t.field_2, t.test,
     ^
  count(*) as cnt
               ^
from data.data_test_news_record_da t
      ^    ^
where pt = 2
       ^
group by
  t.field_2, t.test
     ^       ^
;`,
    `select
  t1.house_code, t1.resblock_id, t2.quota_date
  ^   ^                           ^  ^
from data.data_test_news_record_di t1
     ^      ^
  left join data.data_test_quota_similar_house_region_da t2
              ^  ^                                       ^
  on t1.house_code = t2.house_code
      ^  ^           ^     ^
    and t1.resblock_id = t2.resblock_id
        ^  ^             ^     ^
where t1.pt = 2;
      ^
`,
    `
with t1 as (
  select
    house_code, resblock_id, resblock_name
  from data.data_test_news_record_di
        ^     ^
  where pt = 2
),
t2 as (
  select
    house_code, resblock_id, quota_date
  from data.data_test_quota_similar_house_region_da
)
select
  t1.house_code, t1.resblock_id, t2.quota_date
  ^   ^                           ^  ^
from t1
     ^
  left join t2
            ^
  on t1.house_code = t2.house_code
  and t1.resblock_id = t2.resblock_id
;
`,
    `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
                                                      ^  ^
  from data.data_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
            ^
        from data.data_test_news_record_da
                ^    ^
  ) t2
    ^ 
  on t1.house_code = t2.house_code
                     ^     ^
  and t1.resblock_id = t2.resblock_id
  where t1.pt = 2
)
select
  t.house_code, t.resblock_id, t.quota_date
from t1 t
;
`, `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
    ^
  from data.data_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
        from data.data_test_news_record_da
  ) t2
    ^ 
  on t1.house_code = t2.house_code
     ^
  and t1.resblock_id = t2.resblock_id
                        ^
  where t1.pt = 2
)
select
  t.house_code, t.resblock_id, t.quota_date
from t1 t
;
`, `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
  from data.data_test_news_record_di t1
  where t1.pt = 2
)
select
  t1.house_code, t1.resblock_id, t1.quota_date
from t1
     ^
;
`, `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
  from data.data_test_news_record_di t1
  where t1.pt = 2
)
select
  t.house_code, t.resblock_id, t.quota_date
  ^
from t1 t
;
`,
    `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
  from data.data_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
        from data.data_test_news_record_da
  ) t2
  on t1.house_code = t2.house_code
                     ^
  and t1.resblock_id = t2.resblock_id
  where t1.pt = 2
)
select
  t.house_code, t.resblock_id, t.quota_date
from t1 t
;
`,
`
select * from (
    select
    ^
        house_code, resblock_id, quota_date
    from data.data_test_news_record_da
) t2
   ^
;`,
`
select * from (
    select
        house_code, resblock_id, quota_date
    from data.data_test_news_record_da
) t2
  ^
;`
].map(x => caseFromString(x));

console.log('sql test cases', sqlTest);

