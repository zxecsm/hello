import os from 'os';
import { resolve } from 'path';

import appConfig from '../../config/index.js';
import { _d } from '../../config/store.js';
import _f from '../fs/f.js';
import { getDirname } from '../common/utils.js';
import { getCacheStats } from '../common/cache.js';
import { getSql, allSql } from '../db/sqlite.js';
import { getTrustProxy } from '../web/getClientIp.js';
import { getSystemUsage } from './sys.js';
import timedTask from './timedTask.js';
import taskState from './taskState.js';

const __dirname = getDirname(import.meta);

const processStartedAt = Date.now() - Math.round(process.uptime() * 1000);

// 读取服务版本号（打包环境下可能读不到，忽略即可）
function getVersion() {
  try {
    const pkg = JSON.parse(_f.fs.readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'));
    return pkg.version || '';
  } catch {
    return '';
  }
}

async function getFileSize(path) {
  const stat = await _f.lstat(path);
  return stat?.size || 0;
}

// 字节数自动换算为 B / KB / MB / GB / TB
function formatSize(size) {
  return Number(size) > 0 ? _f.formatBytes(size) : '0B';
}

// 百分比保留两位小数
function formatPercent(value) {
  return Number((Number(value) || 0).toFixed(2));
}

// 秒 → 0.19s / 1m 30s / 2d 2h
function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);

  // 不足一分钟保留两位小数，CPU 时间等小数值也能看出来
  if (total < 60) return `${Number(total.toFixed(2))}s`;

  let rest = Math.floor(total);
  const parts = [];

  for (const [unit, size] of [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ]) {
    if (rest >= size) {
      parts.push(`${Math.floor(rest / size)}${unit}`);
      rest %= size;
    }
  }

  return parts.join(' ') || '0s';
}

// 毫秒 → 500ms / 1m 30s
function formatDurationMs(ms) {
  const value = Number(ms) || 0;
  return value < 1000 ? `${Math.round(value)}ms` : formatDuration(value / 1000);
}

// 给内存 / 磁盘等容量对象补充可读文本
function withSizeText(target) {
  const result = { ...target, percent: formatPercent(target.percent) };

  for (const key of ['total', 'used', 'free', 'available']) {
    if (typeof target[key] === 'number') {
      result[`${key}Text`] = formatSize(target[key]);
    }
  }

  return result;
}

// 数据库运行状态
async function getDatabaseStatus() {
  const dbDir = appConfig.databaseDir();
  const dbPath = appConfig.databaseDir('hello.db');

  const pragma = (sql, key) => {
    try {
      return getSql(sql)?.[key] || 0;
    } catch {
      return 0;
    }
  };

  // 汇总所有业务表的行数
  const tables = {};
  try {
    const rows = allSql(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    for (const { name } of rows) {
      try {
        const safeName = name.replace(/"/g, '""');
        tables[name] = getSql(`SELECT COUNT(*) AS count FROM "${safeName}"`)?.count || 0;
      } catch {
        tables[name] = -1;
      }
    }
  } catch {
    // 数据库暂不可用时忽略
  }

  const pageCount = pragma('PRAGMA page_count', 'page_count');
  const pageSize = pragma('PRAGMA page_size', 'page_size');
  const freelistCount = pragma('PRAGMA freelist_count', 'freelist_count');
  const walSize = await getFileSize(`${dbPath}-wal`);
  const shmSize = await getFileSize(`${dbPath}-shm`);
  const mainSize = await getFileSize(dbPath);

  return {
    path: dbPath,
    dir: dbDir,
    size: mainSize,
    sizeText: _f.formatBytes(mainSize),
    walSize,
    walSizeText: _f.formatBytes(walSize),
    shmSize,
    shmSizeText: _f.formatBytes(shmSize),
    pageCount,
    pageSize,
    pageSizeText: formatSize(pageSize),
    freelistCount,
    usedSize: pageCount * pageSize,
    usedSizeText: formatSize(pageCount * pageSize),
    journalMode: (() => {
      try {
        return getSql('PRAGMA journal_mode')?.journal_mode || '';
      } catch {
        return '';
      }
    })(),
    tables,
  };
}

// 定时任务与后台任务
function getTaskStatus() {
  let running = 0;

  for (const task of taskState.tasks.values()) {
    if (task.state === 0) running++;
  }

  return {
    timedTasks: timedTask.count(),
    backgroundTasks: taskState.tasks.size,
    runningTasks: running,
  };
}

// 仅输出不包含敏感信息的配置项
function getSafeConfig() {
  return {
    appName: appConfig.appName,
    port: appConfig.port,
    host: appConfig.host,
    dataDir: appConfig.dataDir(),
    trustProxy: getTrustProxy(),
    cookieSecure: /^(1|true|on|yes)$/i.test(String(process.env.COOKIE_SECURE || '')),
    registerState: !!_d.registerState,
    trashState: !!_d.trashState,
    pubApi: { ..._d.pubApi },
    cacheExp: { ..._d.cacheExp },
    email: {
      state: !!_d.email?.state,
      host: _d.email?.host || '',
      port: _d.email?.port || 0,
      secure: !!_d.email?.secure,
    },
  };
}

// 收集健康检查所需的全部信息
export async function getHealthStatus() {
  const [system, database] = await Promise.all([
    getSystemUsage(appConfig.dataDir()),
    getDatabaseStatus(),
  ]);

  const memory = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = Math.round(process.uptime());
  const osUptime = Math.round(os.uptime());

  return {
    status: 'ok',
    time: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      env: process.env.NODE_ENV || 'production',
      packaged: !!process.pkg,
      version: getVersion(),
      startedAt: new Date(processStartedAt).toISOString(),
      uptime,
      uptimeText: formatDuration(uptime),
      osUptime,
      osUptimeText: formatDuration(osUptime),
    },
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      loadavg: os.loadavg(),
      cpu: {
        ...system.cpu,
        percent: formatPercent(system.cpu.percent),
      },
      mem: withSizeText(system.mem),
      swap: withSizeText(system.swap),
      disk: withSizeText(system.disk),
      net: {
        ...system.net,
        rxText: `${formatSize(system.net.rx)}/s`,
        txText: `${formatSize(system.net.tx)}/s`,
      },
    },
    process: {
      memory: {
        rss: memory.rss,
        rssText: formatSize(memory.rss),
        heapTotal: memory.heapTotal,
        heapTotalText: formatSize(memory.heapTotal),
        heapUsed: memory.heapUsed,
        heapUsedText: formatSize(memory.heapUsed),
        external: memory.external,
        externalText: formatSize(memory.external),
        arrayBuffers: memory.arrayBuffers,
        arrayBuffersText: formatSize(memory.arrayBuffers),
      },
      cpu: {
        user: cpuUsage.user,
        userText: formatDuration(cpuUsage.user / 1e6),
        system: cpuUsage.system,
        systemText: formatDuration(cpuUsage.system / 1e6),
      },
    },
    config: getSafeConfig(),
    database,
    caches: getCacheStats().map((cache) => ({
      ...cache,
      ttlText: formatDurationMs(cache.ttl),
      cleanupIntervalText:
        cache.cleanupInterval > 0 ? formatDurationMs(cache.cleanupInterval) : 'off',
      maxSizeText: cache.maxSize > 0 ? cache.maxSize : 'unlimited',
      hitRateText: `${(cache.hitRate * 100).toFixed(2)}%`,
    })),
    tasks: getTaskStatus(),
  };
}
