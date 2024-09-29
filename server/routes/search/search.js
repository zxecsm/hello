const configObj = require('../../data/config');
const { resolve } = require('path');
const _f = require('../../utils/f');

async function getSearchConfig() {
  const p = `${configObj.filepath}/data/searchConfig.json`;
  const logop = `${configObj.filepath}/searchlogo`;
  if (!_f.c.existsSync(logop)) {
    await _f.cp(resolve(__dirname, `../../img/searchlogo`), logop);
  }
  if (!_f.c.existsSync(p)) {
    await _f.cp(resolve(__dirname, `../../data/searchConfig.json`), p);
  }
  return JSON.parse(await _f.p.readFile(p));
}

module.exports = {
  getSearchConfig,
};
