import { getRandomRow } from '../../utils/sqlite.js';

// 获取随机一条壁纸
export function getRandowBg(type, fields) {
  return getRandomRow('bg', fields, `WHERE type = ?`, [type]);
}
