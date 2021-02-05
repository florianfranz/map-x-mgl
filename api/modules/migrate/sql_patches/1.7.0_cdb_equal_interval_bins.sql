-- https://github.com/CartoDB/cartodb-postgresql/blob/master/scripts-available/
--
-- Calculate the equal interval bins for a given column
--
-- @param in_array An array of numbers to determine the best
--                   bin boundary
--
-- @param breaks The number of bins you want to find.
--  
--
-- Returns: upper edges of bins
-- 
--

CREATE OR REPLACE FUNCTION CDB_EqualIntervalBins ( in_array anyarray, breaks INT ) RETURNS anyarray as $$
WITH stats AS (
  SELECT min(e), (max(e)::decimal-min(e))/breaks AS del
    FROM (SELECT unnest(in_array) e) AS p)
SELECT array_agg(bins)
  FROM (
    SELECT min + generate_series(1,breaks)*del AS bins
      FROM stats) q;
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
