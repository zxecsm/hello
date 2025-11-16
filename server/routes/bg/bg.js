import { db } from '../../utils/sqlite.js';

// 获取随机一条壁纸
export function getRandomBg(type, fields) {
  return db('bg').select(fields).where({ type }).getRandomOne();
}
