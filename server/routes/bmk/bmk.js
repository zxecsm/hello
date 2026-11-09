import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _f from '../../utils/f.js';
import _path from '../../utils/path.js';
import { db } from '../../utils/sqlite.js';
import { concurrencyTasks, writelog } from '../../utils/utils.js';
import { heperMsgAndForward } from '../chat/chat.js';
import { _delDir, readMenu } from '../file/file.js';

// 按 num 重新排序
function reorderByNum(table, where) {
  const list = db(table).select('id').where(where).orderBy('num', 'ASC').find();
  if (!list.length) return;

  const ids = list.map((item) => item.id);

  db(table).batchDiffUpdate(
    [{ match: 'id', field: 'num', items: ids.map((id, num) => ({ id, num })) }],
    { id: { in: ids } },
  );
}

export function updateBmkGroupOrder(account) {
  reorderByNum('bmk_group', { account, state: 1 });
}

export function updateBmkOrder(account, groupId) {
  reorderByNum('bmk', { account, state: 1, group_id: groupId });
}

// 移动一条记录到目标位置，并重排 num
function moveLocation(table, where, fromId, toId) {
  if (fromId === toId) return;

  const list = db(table).select('id').where(where).orderBy('num', 'ASC').find();
  const fromIdx = list.findIndex((item) => item.id === fromId);
  const toIdx = list.findIndex((item) => item.id === toId);

  if (fromIdx < 0 || toIdx < 0) return;

  list.splice(toIdx, 0, ...list.splice(fromIdx, 1));

  const ids = list.map((item) => item.id);

  db(table).batchDiffUpdate(
    [{ match: 'id', field: 'num', items: ids.map((id, num) => ({ id, num })) }],
    { id: { in: ids } },
  );
}

export function bookListMoveLocation(account, fromId, toId) {
  moveLocation('bmk_group', { account, state: 1 }, fromId, toId);
}

export function bookmarkMoveLocation(account, groupId, fromId, toId) {
  moveLocation('bmk', { account, state: 1, group_id: groupId }, fromId, toId);
}

// 分组是否存在
export function bmkGroupExist(account, groupId) {
  return db('bmk_group').select('id').where({ account, state: 1, id: groupId }).findOne();
}

// 清理缓存siteInfo
export async function cleanSiteInfo(res = false) {
  if (_d.cacheExp.siteInfoCache > 0 && (await _f.getType(appConfig.siteinfoDir())) === 'dir') {
    const now = Date.now();

    const threshold = now - _d.cacheExp.siteInfoCache * 24 * 60 * 60 * 1000;

    const sList = await readMenu(appConfig.siteinfoDir());

    let num = 0;

    await concurrencyTasks(sList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalizeNoSlash(path, name));
          num++;
        }
      }
    });

    if (num) {
      const text = `删除过期网站描述信息缓存：${num}`;
      await writelog(res, text);
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
}

// 清理缓存favicon
export async function cleanFavicon(res = false) {
  if (_d.cacheExp.faviconCache > 0 && (await _f.getType(appConfig.faviconDir() === 'dir'))) {
    const now = Date.now();

    const threshold = now - _d.cacheExp.faviconCache * 24 * 60 * 60 * 1000;

    const fList = await readMenu(appConfig.faviconDir());

    let num = 0;

    await concurrencyTasks(fList, 5, async (item) => {
      const { name, path, time, type } = item;

      if (type === 'file') {
        if (time < threshold) {
          await _delDir(_path.normalizeNoSlash(path, name));
          num++;
        }
      }
    });

    if (num) {
      const text = `删除过期缓存图标：${num}`;
      await writelog(res, text);
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
}
