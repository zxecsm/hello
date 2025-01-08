import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _path from '../../utils/path.js';
import {
  queryData,
  batchDiffUpdateData,
  fillString,
} from '../../utils/sqlite.js';
import { concurrencyTasks, writelog } from '../../utils/utils.js';
import { _delDir, readMenu } from '../file/file.js';

// 移动分组位置
export async function bookListMoveLocation(account, fromId, toId) {
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

    // 批量更新对应的位置
    await batchDiffUpdateData(
      'bmk_group',
      data,
      `WHERE id IN (${fillString(list.length)})`,
      list.map((item) => item.id)
    );
  }
}

// 移动书签位置
export async function bookmarkMoveLocation(account, groupId, fromId, toId) {
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
export async function bmkGroupExist(account, groupId) {
  const list = await queryData(
    'bmk_group',
    'id',
    `WHERE account = ? AND state = ? AND id = ?`,
    [account, 1, groupId]
  );

  return list.length > 0;
}

// 清理缓存siteInfo
export async function cleanSiteInfo(req = false) {
  if (_d.cacheExp.siteInfoCache > 0) {
    const now = Date.now();

    const threshold = now - _d.cacheExp.siteInfoCache * 24 * 60 * 60 * 1000;

    const sList = await readMenu(
      _path.normalize(`${appConfig.appData}/siteinfo`)
    );

    let num = 0;

    await concurrencyTasks(sList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalize(`${path}/${name}`));
          num++;
        }
      }
    });

    if (num) {
      await writelog(req, `删除过期网站描述信息缓存：${num}`, 'user');
    }
  }
}

// 清理缓存favicon
export async function cleanFavicon(req = false) {
  if (_d.cacheExp.faviconCache > 0) {
    const now = Date.now();

    const threshold = now - _d.cacheExp.faviconCache * 24 * 60 * 60 * 1000;

    const fList = await readMenu(
      _path.normalize(`${appConfig.appData}/favicon`)
    );

    let num = 0;

    await concurrencyTasks(fList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalize(`${path}/${name}`));
          num++;
        }
      }
    });

    if (num) {
      await writelog(req, `删除过期缓存图标：${num}`, 'user');
    }
  }
}
