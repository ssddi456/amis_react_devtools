with news_record_mirror as (
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
;