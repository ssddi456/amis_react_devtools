import { caseFromString } from './tools/tests';

export const sqlTest = [
    // simple
    `
select * from rpr_test_news_record_di where pt = 1;
               ^
`
,`
select * from rpr.rpr_test_news_record_di where data.pt = 1;
                ^   ^                               ^   ^
`,
    `
select * from rpr.rpr_test_news_record_di where data.pt = 1;
                  ^                                   ^  
`
// simple with alias
,`select
  field_2, t.test
    ^      ^ ^
from rpr_test_news_record_da t
      ^
where pt = 2;
      ^
`
// simple with alias
,`select
  field_2, t.test
    ^
from rpr_test_news_record_da t
where pt = 2;
`
// simple with alias
,`select
  field_2, t.test
from rpr_test_news_record_da t
                             ^
where pt = 2;
`
,`select
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
;`
,`select
  t1.house_code, t1.resblock_id, t2.quota_date
  ^   ^                           ^  ^
from rpr.rpr_test_news_record_di t1
     ^      ^
  left join rpr.rpr_test_quota_similar_da t2
              ^  ^                                      ^
  on t1.house_code = t2.house_code
      ^  ^           ^     ^
    and t1.resblock_id = t2.resblock_id
        ^  ^             ^     ^
where t1.pt = 2;
      ^
`
,`
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
  from rpr.rpr_test_quota_similar_da
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
`
,`
with t1 as (
     ^
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
`
,`
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
`
,`
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
`
,`
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
`
,`
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
`
,`
select * from (
    select
    ^
        house_code, resblock_id, quota_date
    from rpr.rpr_test_news_record_da
) t2
   ^
;`
,`
select * from (
    select
        house_code, resblock_id, quota_date
    from rpr.rpr_test_news_record_da
) t2
  ^
;`
,`
select count(*), count(distinct resblock_id)
        ^         ^     ^         ^
from rpr.rpr_test_news_record_da
;`
,`select * from t1 left join t2 using (house_code, resblock_id)
`
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
,`
with t1 as (
  select
    house_code, resblock_id, quota_date
  from rpr.rpr_test_quota_similar_da
),
t2 as (
  select
    *
  from t1
)
insert into rpr.rpr_test_da
select
  t1.house_code, t1.resblock_id, t2.quota_date
from t1
  left join t2
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
;
`
,`
with t1 as (
  select
    house_code, resblock_id, quota_date
  from rpr.rpr_test_quota_similar_da
),
t2 as (
  select
    *
  from t1
)
select
  t1.house_code, t1.resblock_id, t2.quota_date
from t1
  left join t2
    on t1.house_code = t2.house_code
    and t1.resblock_id = t2.resblock_id
;
`
,`
with t1 as (
  select
    house_code, resblock_id, resblock_name
  from rpr.rpr_test_news_record_di
  where pt = 2
),
t2 as (
  select
    house_code, resblock_id, quota_date
  from rpr.rpr_test_quota_similar_da
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
`
,`with news_record_mirror as (
    select 
        *
    from
        rpr.rpr_news_record_da
    WHERE
        pt='\${-1d_pt}' and news_time > date_sub(current_date(), 7)
),
all_house_code as (
    select distinct house_code
    from
        news_record_mirror
 	where
  		news_type != 'xiao_forward'
),
new_count as (
    select
        house_code,
        count(*) as new
    from
        news_record_mirror
    WHERE
        news_type = 'new'
    group by
        house_code
),
deal_count as (
    select
        house_code,
        count(*) as deal
    from
        news_record_mirror
    WHERE
        news_type = 'deal'
    group by
        house_code
),
visit_count as (
    select
        house_code,
        count(*) as visit
    from
        news_record_mirror
    WHERE
        news_type = 'visit'
    group by
        house_code
),
visit_deal_count as (
    select
        house_code,
        count(*) as visit_deal
    from
        news_record_mirror
    WHERE
        news_type = 'visit_deal'
    group by
        house_code
),
xiao_forward_count as (
    select
        house_code,
        count(*) as xiao_forward
    from
        news_record_mirror
    WHERE
        news_type = 'xiao_forward'
    group by
        house_code
),
price_down_count as (
    select
        house_code,
        count(*) as price_down
    from
        news_record_mirror
    WHERE
        news_type = 'price_down'
    group by
        house_code
)
insert overwrite table rpr.rpr_change_da partition (pt='\${-1d_pt}')
select
    all_house_code.house_code,

    nvl(price_down_count.price_down, 0) as price_down,
    nvl(new_count.new, 0) as new,
    nvl(deal_count.deal, 0) as deal,
    nvl(visit_count.visit, 0) as visit,
    nvl(visit_deal_count.visit_deal, 0) as visit_deal,
    nvl(xiao_forward_count.xiao_forward, 0) as xiao_forward
from
    all_house_code
    left join new_count on all_house_code.house_code = new_count.house_code
    left join deal_count on all_house_code.house_code = deal_count.house_code
    left join visit_count on all_house_code.house_code = visit_count.house_code
    left join visit_deal_count on all_house_code.house_code = visit_deal_count.house_code
    left join xiao_forward_count on all_house_code.house_code = xiao_forward_count.house_code
    left join price_down_count on all_house_code.house_code = price_down_count.house_code
UNION all
SELECT "106124389836", 1, 2, 3, 4, 5, 6 UNION all
SELECT "106124389839", 1, 2, 3, 4, 5, 6
;`
,`with news_record_mirror as (
    select 
        *
        ^
    from
        rpr.rpr_news_record_da
    WHERE
        pt='\${-1d_pt}' and news_time > date_sub(current_date(), 7)
),
all_house_code as (
    select distinct house_code
    from
        news_record_mirror
 	where
  		news_type != 'xiao_forward'
),
new_count as (
    select
        house_code,
        count(*) as new
    from
        news_record_mirror
    WHERE
        news_type = 'new'
    group by
        house_code
),
deal_count as (
    select
        house_code,
        count(*) as deal
    from
        news_record_mirror
    WHERE
        news_type = 'deal'
    group by
        house_code
),
visit_count as (
    select
        house_code,
        count(*) as visit
    from
        news_record_mirror
    WHERE
        news_type = 'visit'
    group by
        house_code
),
visit_deal_count as (
    select
        house_code,
        count(*) as visit_deal
    from
        news_record_mirror
    WHERE
        news_type = 'visit_deal'
    group by
        house_code
),
xiao_forward_count as (
    select
        house_code,
        count(*) as xiao_forward
    from
        news_record_mirror
    WHERE
        news_type = 'xiao_forward'
    group by
        house_code
),
price_down_count as (
    select
        house_code,
        count(*) as price_down
                      ^
    from
        news_record_mirror
    WHERE
        news_type = 'price_down'
    group by
        house_code
)
insert overwrite table rpr.rpr_change_da partition (pt='\${-1d_pt}')
select
    all_house_code.house_code,

    nvl(price_down_count.price_down, 0) as price_down,
    nvl(new_count.new, 0) as new,
    nvl(deal_count.deal, 0) as deal,
    nvl(visit_count.visit, 0) as visit,
    nvl(visit_deal_count.visit_deal, 0) as visit_deal,
    nvl(xiao_forward_count.xiao_forward, 0) as xiao_forward
from
    all_house_code
    left join new_count on all_house_code.house_code = new_count.house_code
    left join deal_count on all_house_code.house_code = deal_count.house_code
    left join visit_count on all_house_code.house_code = visit_count.house_code
    left join visit_deal_count on all_house_code.house_code = visit_deal_count.house_code
    left join xiao_forward_count on all_house_code.house_code = xiao_forward_count.house_code
    left join price_down_count on all_house_code.house_code = price_down_count.house_code
UNION all
SELECT "106124389836", 1, 2, 3, 4, 5, 6 UNION all
SELECT "106124389839", 1, 2, 3, 4, 5, 6
;`
,`SELECT 
    p.product_id,
    p.product_name,
    p.price,
    p.category_id
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products 
    WHERE category_id = p.category_id
)
AND EXISTS (
    SELECT 1 
    FROM order_items oi 
    WHERE oi.product_id = p.product_id 
      AND oi.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
)
ORDER BY p.price DESC;`
,`SELECT id, name, email, created_at
FROM users 
WHERE status = 'active' 
  AND created_at > '2023-01-01'
ORDER BY created_at DESC
          ^
LIMIT 100;`
,`SELECT 
      customer_id,
      SUM(total_amount) as total_spent,
      COUNT(*) as total_orders,
      CASE 
      ^
          WHEN SUM(total_amount) >= 10000 THEN 'VIP'
          WHEN SUM(total_amount) >= 1000 THEN 'Premium'
          ELSE 'Standard'
      END as customer_segment
  FROM orders
  WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
  GROUP BY customer_id
`
,`SELECT 
    p.product_id,
    p.product_name,
    p.price,
    p.category_id
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products 
    WHERE category_id = p.category_id
                        ^
)
AND EXISTS (
    SELECT 1 
    FROM order_items oi 
    WHERE oi.product_id = p.product_id 
                          ^
      AND oi.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
)
ORDER BY p.price DESC;`
,`SELECT id, name, email, created_at as alt_created_at
FROM users 
WHERE status = 'active' 
  AND created_at > '2023-01-01'
ORDER BY alt_created_at DESC
         ^
LIMIT 100;`
,`SELECT 
    p.product_id, -- some comments
                     ^
    p.product_name,
    p.price,
    p.category_id
FROM products p`
,`SELECT
  a.house_code,
  a.week_date_cycle as cycle,
  (
    case
    when b.house_area = 0 or b.house_area = NULL then 0
    else ROUND(b.price_listing / b.house_area, 2)
    end
  ) AS avg_price
FROM 
  quota_date a
  left join week_house_price_info_sum b on a.house_code = b.house_code and a.week_date_cycle = b.cycle`

].map(x => caseFromString(x));
