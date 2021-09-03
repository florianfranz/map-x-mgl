WITH
attr_null_value as (
  -- Allowed text value to express "null"/"missing"/"not set" value
  SELECT 
  CASE 
   WHEN  LOWER('{{nullValue}}') = ANY (ARRAY['undefined','null','na','']) 
   THEN  NULL 
  ELSE
    '{{nullValue}}'
   END as val
),
attr_table_raw as (
  SELECT
  "{{idAttr}}" as value,
  count(*) as count FROM
  {{idSource}} s, attr_null_value n
  WHERE NOT
  (
    s."{{idAttr}}" IS NULL OR
    s."{{idAttr}}" = '' OR
    s."{{idAttr}}" ~ '^\s+$' OR
    CASE WHEN n.val IS NULL 
      --- NOT false = true 
      THEN false
      -- convert to float the nullValue
      ELSE
        s."{{idAttr}}" = n.val 
    END
  )
  GROUP BY
  "{{idAttr}}"
  ORDER BY count desc
),
attr_table as (
  SELECT * 
  FROM attr_table_raw
  LIMIT {{maxRowsCount}}
),
attr_table_raw_count as (
  SELECT count(*) from attr_table_raw
),
attr_table_count as (
  SELECT count(*) from attr_table
),
attr_table_json as (
  SELECT json_agg(
    json_build_object(
      'value', at.value, 
      'count', at.count
    ) 
  ) as json
  FROM attr_table at
)

SELECT json_build_object(
  'attribute_stat', json_build_object(
    'type', 'categorical',
    'attribute', '{{idAttr}}',
    'nullValue', n.val,
    'table', to_json(atj.json),
    'table_row_count_all', to_json(tcr.count), 
    'table_row_count', to_json(tc.count)
  )
) as res
FROM
attr_table_json as atj, 
attr_table_count as tc,
attr_table_raw_count as tcr,
attr_null_value n;
