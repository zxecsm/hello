import { db } from './sqlite.js';
import { CacheByExpire } from './cache.js';

// 用户信息缓存：key = account，TTL 仅作兜底，信息变更时主动失效
const userInfoCache = new CacheByExpire(5 * 60 * 1000, 60 * 1000, { maxSize: 10000 });

// 失效代际：防止「查询进行中发生修改」时把旧数据重新写回缓存
let generation = 0;

// 获取用户信息（带缓存）
export async function getUserInfoCached(account) {
  if (!account) return null;

  const cached = userInfoCache.get(account);
  if (cached) return { ...cached };

  const currentGeneration = generation;
  const user = db('user').select('*').where({ account, state: 1 }).findOne();

  if (!user) return null;

  // 查询期间发生过失效，则跳过本次写入，避免缓存旧数据
  if (currentGeneration === generation) {
    userInfoCache.set(account, user);
  }

  return { ...user };
}

// 删除指定账号的缓存；不传账号则清空全部
export function clearUserInfoCache(account) {
  generation++;

  if (account) {
    userInfoCache.delete(account);
  } else {
    userInfoCache.clear();
  }
}

// 仅更新 update_at 这类心跳字段时直接修改缓存副本，避免把缓存整体清掉
export function touchUserInfoCache(account, updateAt = Date.now()) {
  const cached = userInfoCache.get(account);
  if (cached) cached.update_at = updateAt;
}
