import { getRandomRow } from '../../utils/sqlite.js';

export function getRandowBg(type, fields) {
  return getRandomRow('bg', fields, `WHERE type = ?`, [type]);
}
