const {redisGet, redisSet, pgRead} = require('@mapx/db');
const {getParamsValidator} = require('@mapx/route_validation');
const {sendError, sendJSON} = require('@mapx/helpers');
const crypto = require('crypto');
const validateParamsHandlerBbox = getParamsValidator({
  expected: ['name', 'code', 'srid', 'language']
});

const mwGetBbox = [validateParamsHandlerBbox, handlerBbox];

module.exports = {
  mwGetBbox
};

async function handlerBbox(req, res) {
  const query = req.query;
  try {
    query.code = query.code || query.name;

    const q = `
    SELECT
    json(
    ST_ASGeoJSON(
    mx_bbox_geocode(
    '${query.code}',
    '${query.language}',
     ${query.srid}
  ))) bbox`;

    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(q))
      .digest('hex');

    const cached = await redisGet(hash);

    if (cached) {
      return sendJSON(res, JSON.parse(cached));
    } else {
      const result = await pgRead.query(q);
      const data = result.rows[0];

      if (!data || !data?.bbox) {
        throw new Error(`No result found for ${query.code}`);
      }
      const coords = data?.bbox?.coordinates[0];

      /**
       * Simple bounds
       * see https://docs.mapbox.com/mapbox-gl-js/api/geography/#lnglatboundslike
       */

      const bbox = [
        coords[0][0], //west
        coords[0][1], //south
        coords[2][0], //east
        coords[2][1] //north
      ];

      await redisSet(hash, JSON.stringify(bbox));

      return sendJSON(res, bbox);
    }
  } catch (err) {
    sendError(res, err);
  }
}
