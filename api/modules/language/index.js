const {readTxt, parseTemplate} = require('@mapx/helpers');
const {pgAdmin, pgRead} = require('@mapx/db');

const fs = require('fs');
const path = require('path');
const dir = 'dict/_built';
const db = {};
const files = fs.readdirSync(path.join(__dirname, dir));
const dicts_lang = files.filter((f) => f.match(/.*dict_[a-z]{2}\.json$/gm));
const dict_full = path.join(__dirname, dir, 'dict_full.json');

dicts_lang.forEach((file) => {
  const name = path.parse(file).name;
  const lang = name.split(/_|\./)[1];
  const data = JSON.parse(readTxt(path.join(__dirname, dir, file)));
  db[lang] = {};
  data.forEach((d) => {
    db[lang][d.id] = d[lang] || d.en || d.id;
  });
});

/**
 * Init language;
 */
async function init() {
  try {
    /**
     * Copy in postgres
     */
    const start = Date.now();
    const done = await importDict();
    if (done) {
      console.log(`Imported dict in ${Date.now() - start} ms`);
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * Simple translate + template function
 * @param {String} lang Two letter code language. e.g. 'en'
 * @param {String} id Dictionary entry id
 * @param {Object} data Data used for templating e.g. 'User name is {{name}}' + {name:'bob'} = 'User name is bob'
 * @return {String}
 */
function translate(lang, id, data) {
  let item;
  try {
    item = db[lang || 'en'][id];
    if (data) {
      item = parseTemplate(item, data);
    }
  } catch (e) {}
  return item || id;
}

/**
 * Import dict CSV
 */
async function importDict() {
  const fileExists = fs.existsSync(dict_full);
  if (!fileExists) {
    return;
  }
  const client = await pgAdmin.connect();
  try {
    const dict = JSON.parse(readTxt(dict_full));
    await client.query('BEGIN');
    await client.query('DELETE FROM mx_dict_translate');
    for (let r = 0, rL = dict.length; r < rL; r++) {
      const row = dict[r];
      const keys = Object.keys(row).join(',');
      const values = Object.values(row)
        .map(client.escapeLiteral)
        .join(',');
      await client.query(
        `INSERT INTO mx_dict_translate (${keys}) VALUES (${values})`
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
  }
  return true;
}

/**
 * Get m49 and iso3 countries translation
 */
async function getDictM49iso3() {
  try {
    const resp = await pgRead.query(
      `select * from mx_dict_translate where id ~ '(^m49_.*|^[A-Z]{3})'`
    );
    return resp.rows;
  } catch (e) {
    console.error(e);
  }
}

/**
 * Exports
 */
module.exports = {
  t: translate,
  translate,
  init,
  getDictM49iso3
};
