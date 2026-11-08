import os from 'os';
import _f from './f.js';

// CPU
const getRawCpuUsage = (() => {
  let prevIdle = 0;
  let prevTotal = 0;

  return () => {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) totalTick += cpu.times[type];
      totalIdle += cpu.times.idle;
    });

    const totalDiff = totalTick - prevTotal;
    const idleDiff = totalIdle - prevIdle;
    prevIdle = totalIdle;
    prevTotal = totalTick;

    const percent = totalDiff ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
    return {
      percent,
      cores: cpus.length,
      arch: os.arch(),
    };
  };
})();

// 网速
const getNetSpeed = (() => {
  let last = { rx: 0, tx: 0, time: 0 };

  return async () => {
    try {
      const content =
        (await _f.readFile('/app/proc/1/net/dev', null, '')).toString() ||
        (await _f.readFile('/proc/net/dev', null, '')).toString();

      let totalRx = 0;
      let totalTx = 0;

      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        // eth0: 95293989600 49177599    0  435    0     0          0         0 26449124473 31286392    0    0    0     0       0          0
        if (!/^(eth|en|wl)/.test(trimmed)) continue;

        const parts = trimmed.split(':');
        if (parts.length < 2) continue;

        const stats = parts[1].trim().split(/\s+/).filter(Boolean);

        if (stats.length >= 9) {
          totalRx += parseInt(stats[0]) || 0; // Receive
          totalTx += parseInt(stats[8]) || 0; // Transmit
        }
      }

      const now = Date.now();
      let speed = { rx: 0, tx: 0 };

      if (last.time > 0) {
        const interval = (now - last.time) / 1000;
        if (interval > 0) {
          speed = {
            rx: Math.max(0, (totalRx - last.rx) / interval),
            tx: Math.max(0, (totalTx - last.tx) / interval),
          };
        }
      }

      last = { rx: totalRx, tx: totalTx, time: now };
      return speed;
    } catch {
      return { rx: 0, tx: 0 };
    }
  };
})();

// 内存（Memory）
const getRawMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percent = total ? (used / total) * 100 : 0;
  return {
    total,
    free,
    used,
    percent,
  };
};

// 磁盘 （Disk）
async function getDiskUsage(path = '/') {
  const defaultRes = { total: 0, used: 0, available: 0, percent: 0 };

  try {
    const stats = await _f.fsp.statfs(path);
    const bsize = stats.bsize;

    const total = stats.blocks * bsize;
    const free = stats.bfree * bsize;
    const available = stats.bavail * bsize;
    const used = total - free;

    return {
      total,
      used,
      available,
      percent: total ? (used / total) * 100 : 0,
    };
  } catch {
    return defaultRes;
  }
}

// 依次尝试读取 /proc 文件
async function readProc(paths) {
  for (const p of paths) {
    const content = (await _f.readFile(p, null, '')).toString();
    if (content) return content;
  }
  return '';
}

// 虚拟内存（Swap）
async function getRawVirtualMemoryUsage() {
  const defaultRes = { total: 0, used: 0, free: 0, percent: 0 };

  try {
    const content = await readProc(['/app/proc/meminfo', '/proc/meminfo']);

    if (!content) return defaultRes;

    const get = (key) => {
      const match = content.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'));
      return match ? Number(match[1]) * 1024 : 0;
    };

    const total = get('SwapTotal');
    const free = get('SwapFree');
    const used = Math.max(0, total - free);

    return {
      total,
      used,
      free,
      percent: total ? (used / total) * 100 : 0,
    };
  } catch {
    return defaultRes;
  }
}

let cpuCache = { value: 0, time: 0 };
let memCache = { value: null, time: 0 };
let diskCache = { value: null, time: 0 };
let swapCache = { value: null, time: 0 };
let netCache = { value: null, time: 0 };

export async function getSystemUsage(path = '/') {
  const now = Date.now();

  if (now - cpuCache.time > 1000) {
    cpuCache = { value: getRawCpuUsage(), time: now };
  }

  if (now - netCache.time > 1000) {
    netCache = { value: await getNetSpeed(), time: now };
  }

  if (now - memCache.time > 2000) {
    memCache = { value: getRawMemoryUsage(), time: now };
  }

  if (now - swapCache.time > 2000) {
    swapCache = { value: await getRawVirtualMemoryUsage(), time: now };
  }

  if (now - diskCache.time > 5000) {
    diskCache = { value: await getDiskUsage(path), time: now };
  }

  return {
    cpu: cpuCache.value,
    mem: memCache.value,
    swap: swapCache.value,
    disk: diskCache.value,
    net: netCache.value,
  };
}
