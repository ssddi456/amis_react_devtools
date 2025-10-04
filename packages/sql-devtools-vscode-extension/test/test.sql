SELECT
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
  left join week_house_price_info_sum b on a.house_code = b.house_code and a.week_date_cycle = b.cycle