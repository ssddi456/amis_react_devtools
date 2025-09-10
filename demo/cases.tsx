import { caseFromString } from './tools/tests';

export const sqlTest = [
    // simple
    `
select * from rpr_test_news_record_di where pt = 1;
               ^
`,
    `
select * from rpr.rpr_test_news_record_di where data.pt = 1;
                ^   ^                               ^   ^
`,
    `
select * from rpr.rpr_test_news_record_di where data.pt = 1;
                  ^                                   ^  
`,
  // simple with alias
  // simple with alias
  `select
  field_2, t.test
    ^      ^ ^
from rpr_test_news_record_da t
      ^
where pt = 2;
      ^
`,
  // simple with alias
  // simple with alias
  `select
  field_2, t.test
    ^
from rpr_test_news_record_da t
where pt = 2;
`,

    `select
  t.field_2, t.test,
     ^
  count(*) as cnt
               ^
from rpr.rpr_test_news_record_da t
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
from rpr.rpr_test_news_record_di t1
     ^      ^
  left join rpr.rpr_test_quota_similar_house_region_da t2
              ^  ^                                      ^
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
  from rpr.rpr_test_news_record_di
        ^     ^
  where pt = 2
),
t2 as (
  select
    house_code, resblock_id, quota_date
  from rpr.rpr_test_quota_similar_house_region_da
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
  from rpr.rpr_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
            ^
        from rpr.rpr_test_news_record_da
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
  from rpr.rpr_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
        from rpr.rpr_test_news_record_da
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
  from rpr.rpr_test_news_record_di t1
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
  from rpr.rpr_test_news_record_di t1
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
  from rpr.rpr_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
        from rpr.rpr_test_news_record_da
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
    from rpr.rpr_test_news_record_da
) t2
   ^
;`,
`
select * from (
    select
        house_code, resblock_id, quota_date
    from rpr.rpr_test_news_record_da
) t2
  ^
;`,
`
select count(*), count(distinct resblock_id)
        ^         ^     ^         ^
from rpr.rpr_test_news_record_da
;`
,`select * from t1 left join t2 using (house_code, resblock_id)`
,`select
  t1.house_code,
  t1.resblock_id,
  t1.cityId,
  count(*)
from t1
group by t1.house_code, t1.resblock_id
`
,`select
  t1.house_code,
  t1.resblock_id,
  t1.cityId,
  count(*)
from t1
group by t1.house_code
`
,`select
  t1.house_code,
  t1.resblock_id,
  t1.cityId,
  count(*) as cnt
from t1
group by t1.house_code
`
,`select
  t1.house_code,
  t2.housedel_id as house_code,
  t1.resblock_id
from t1
  left join t2
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
`
,`select
  t1.house_code,
  t1.housedel_id,
  t1.resblock_id
from t1
  left join t1
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
`
,`select
  t1.house_code,
  resblock_id
from t1
  left join t2
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
`
].map(x => caseFromString(x));

console.log('sql test cases', sqlTest);

export const sqlTestDag1 = `
with t1 as (
  select
    house_code, resblock_id, resblock_name
  from rpr.rpr_test_news_record_di
  where pt = 2
),
t2 as (
  select
    house_code, resblock_id, quota_date
  from rpr.rpr_test_quota_similar_house_region_da
),
t3 as (
  select
    *
  from t2
),
t4 as (
  select
    house_code as t4_house_code,
    resblock_id as t4_resblock_id,
    quota_date as t4_quota_date
  from t2
),
t5 as (
  select
    a.house_code as t5_house_code,
    a.resblock_id as t5_resblock_id,
    a.quota_date as t5_quota_date
  from t2 a
),
t6 as (
  select
    a.house_code as house_code,
    '' as test,
    count(*) as count
  from t2 a
  group by a.house_code
  having count > 0
)
select
  t1.house_code, t1.resblock_id, t3.quota_date
from t1
  left join t2
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
  left join t3
    using (house_code, resblock_id)
;
`;