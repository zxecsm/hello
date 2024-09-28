const {
  queryData,
  batchDiffUpdateData,
  fillString,
} = require('../../utils/sqlite');

// 移动分组位置
async function bookListMoveLocation(account, fromId, toId) {
  if (fromId === toId) return;

  const list = await queryData(
    'bmk_group',
    'id',
    `WHERE account = ? AND state = ? ORDER BY num ASC`,
    [account, 1]
  );

  const fIdx = list.findIndex((item) => item.id === fromId),
    tIdx = list.findIndex((item) => item.id === toId);

  if (fIdx >= 0 && tIdx >= 0) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));

    const data = [
      {
        where: 'id',
        key: 'num',
        data: list.map((item, i) => ({ id: item.id, num: i })),
      },
    ];

    await batchDiffUpdateData(
      'bmk_group',
      data,
      `WHERE id IN (${fillString(list.length)})`,
      list.map((item) => item.id)
    );
  }
}

// 移动书签位置
async function bookmarkMoveLocation(account, groupId, fromId, toId) {
  if (fromId === toId) return;

  const bms = await queryData(
    'bmk',
    'id',
    `WHERE account = ? AND state = ? AND group_id = ? ORDER BY num ASC`,
    [account, 1, groupId]
  );

  const fIdx = bms.findIndex((item) => item.id === fromId),
    tIdx = bms.findIndex((item) => item.id === toId);

  if (fIdx >= 0 && tIdx >= 0) {
    bms.splice(tIdx, 0, ...bms.splice(fIdx, 1));
    const data = [
      {
        where: 'id',
        key: 'num',
        data: bms.map((item, i) => ({ id: item.id, num: i })),
      },
    ];

    await batchDiffUpdateData(
      'bmk',
      data,
      `WHERE id IN (${fillString(bms.length)})`,
      bms.map((item) => item.id)
    );
  }
}

// 分组是否存在
async function bmkGroupExist(account, groupId) {
  const list = await queryData(
    'bmk_group',
    'id',
    `WHERE account = ? AND state = ? AND id = ?`,
    [account, 1, groupId]
  );

  return list.length > 0;
}

module.exports = {
  bmkGroupExist,
  bookmarkMoveLocation,
  bookListMoveLocation,
};
