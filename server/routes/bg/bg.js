import { db } from '../../utils/sqlite.js';
import { batchTask, parseJson, unique } from '../../utils/utils.js';

// 获取随机一条壁纸
export function getRandomBg(type, fields) {
  return db('bg').select(fields).where({ type }).getRandomOne();
}

// 获取收藏列表
export async function getCollectBgList(account) {
  let obj = await db('collect_bg').select('data').where({ account }).findOne();

  const list = [];
  if (!obj) {
    await db('collect_bg').insert({
      create_at: Date.now(),
      account,
      data: JSON.stringify(list),
    });
    return list;
  }
  return parseJson(obj.data, list);
}

// 更新收藏列表
export function updateCollecBgtList(account, data) {
  return db('collect_bg')
    .where({ account })
    .update({
      data: JSON.stringify(data),
    });
}

// 分批读取壁纸信息
export async function batchGetCollectBgList(ids) {
  ids = unique(ids);

  const res = {};

  await batchTask(async (offset, limit) => {
    const arr = ids.slice(offset, offset + limit);

    if (arr.length === 0) return false;

    const list = await db('bg')
      .select('id,type')
      .where({ id: { in: arr } })
      .find();

    list.forEach((item) => {
      res[item.id] = item;
    });

    return true;
  }, 800);

  return res;
}
