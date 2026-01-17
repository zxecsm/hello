import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _path from '../../utils/path.js';
import { db } from '../../utils/sqlite.js';
import { concurrencyTasks, writelog } from '../../utils/utils.js';
import { heperMsgAndForward } from '../chat/chat.js';
import { _delDir, readMenu } from '../file/file.js';

// 更新顺序
export async function updateBmkGroupOrder(account) {
  const list = db('bmk_group')
    .select('id')
    .where({ account, state: 1 })
    .orderBy('num', 'ASC')
    .find();

  if (!list.length) return;

  const data = [
    {
      match: 'id',
      field: 'num',
      items: list.map((item, i) => ({ id: item.id, num: i })),
    },
  ];

  await db('bmk_group').batchDiffUpdate(data, {
    id: { in: list.map((item) => item.id) },
  });
}

export async function updateBmkOrder(account, groupId) {
  const bms = await db('bmk')
    .select('id')
    .where({ account, state: 1, group_id: groupId })
    .orderBy('num', 'ASC')
    .find();

  if (!bms.length) return;

  const data = [
    {
      match: 'id',
      field: 'num',
      items: bms.map((item, i) => ({ id: item.id, num: i })),
    },
  ];

  await db('bmk').batchDiffUpdate(data, {
    id: { in: bms.map((item) => item.id) },
  });
}

// 移动分组位置
export async function bookListMoveLocation(account, fromId, toId) {
  if (fromId === toId) return;
  const list = await db('bmk_group')
    .select('id')
    .where({ account, state: 1 })
    .orderBy('num', 'ASC')
    .find();

  const fIdx = list.findIndex((item) => item.id === fromId),
    tIdx = list.findIndex((item) => item.id === toId);

  if (fIdx >= 0 && tIdx >= 0) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));

    const data = [
      {
        match: 'id',
        field: 'num',
        items: list.map((item, i) => ({ id: item.id, num: i })),
      },
    ];

    // 批量更新对应的位置
    await db('bmk_group').batchDiffUpdate(data, {
      id: { in: list.map((item) => item.id) },
    });
  }
}

// 移动书签位置
export async function bookmarkMoveLocation(account, groupId, fromId, toId) {
  if (fromId === toId) return;
  const bms = await db('bmk')
    .select('id')
    .where({ account, state: 1, group_id: groupId })
    .orderBy('num', 'ASC')
    .find();

  const fIdx = bms.findIndex((item) => item.id === fromId),
    tIdx = bms.findIndex((item) => item.id === toId);

  if (fIdx >= 0 && tIdx >= 0) {
    bms.splice(tIdx, 0, ...bms.splice(fIdx, 1));
    const data = [
      {
        match: 'id',
        field: 'num',
        items: bms.map((item, i) => ({ id: item.id, num: i })),
      },
    ];

    await db('bmk').batchDiffUpdate(data, {
      id: { in: bms.map((item) => item.id) },
    });
  }
}

// 分组是否存在
export async function bmkGroupExist(account, groupId) {
  return db('bmk_group').select('id').where({ account, state: 1, id: groupId }).findOne();
}

// 清理缓存siteInfo
export async function cleanSiteInfo(req = false) {
  if (_d.cacheExp.siteInfoCache > 0) {
    const now = Date.now();

    const threshold = now - _d.cacheExp.siteInfoCache * 24 * 60 * 60 * 1000;

    const sList = await readMenu(appConfig.siteinfoDir());

    let num = 0;

    await concurrencyTasks(sList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalize(path, name));
          num++;
        }
      }
    });

    if (num) {
      const text = `删除过期网站描述信息缓存：${num}`;
      await writelog(req, text, 'user');
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
}

// 清理缓存favicon
export async function cleanFavicon(req = false) {
  if (_d.cacheExp.faviconCache > 0) {
    const now = Date.now();

    const threshold = now - _d.cacheExp.faviconCache * 24 * 60 * 60 * 1000;

    const fList = await readMenu(appConfig.faviconDir());

    let num = 0;

    await concurrencyTasks(fList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalize(path, name));
          num++;
        }
      }
    });

    if (num) {
      const text = `删除过期缓存图标：${num}`;
      await writelog(req, text, 'user');
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
}
