const { getRandomRow } = require('../../utils/sqlite');

function getRandowBg(type, fields) {
  return getRandomRow('bg', fields, `WHERE type = ?`, [type]);
}

module.exports = {
  getRandowBg,
};
