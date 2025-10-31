import { exec } from 'child_process';
import os from 'os';
import util from 'util';

const execAsync = util.promisify(exec);

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

    if (totalDiff === 0) return 0;
    return {
      percent: ((totalDiff - idleDiff) / totalDiff) * 100,
      cores: cpus.length,
      arch: os.arch(),
    };
  };
})();

// 内存（Memory）
const getRawMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    percent: (used / total) * 100,
  };
};

// 磁盘 （Disk）
async function getDiskUsage(path = '/') {
  const defaultRes = { total: 0, used: 0, available: 0, percent: 0 };

  try {
    const { stdout } = await execAsync(`df -k '${path}'`);
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return defaultRes;

    const parts = lines[1].split(/\s+/);
    const total = parseInt(parts[1]) * 1024;
    const used = parseInt(parts[2]) * 1024;
    const available = parseInt(parts[3]) * 1024;
    const percent = parseFloat(parts[4]);

    return { total, used, available, percent };
  } catch {
    return defaultRes;
  }
}

// 虚拟内存（Swap）
async function getRawVirtualMemoryUsage() {
  try {
    const { stdout } = await execAsync('free -b');
    const lines = stdout.trim().split('\n');
    if (lines.length < 3) return { total: 0, used: 0, free: 0, percent: 0 };

    const swapLine = lines[2];
    const parts = swapLine.split(/\s+/).filter(Boolean);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const free = parseInt(parts[3]);
    const percent = total ? (used / total) * 100 : 0;

    return { total, used, free, percent };
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0 };
  }
}

let cpuCache = { value: 0, time: 0 };
let memCache = { value: null, time: 0 };
let diskCache = { value: null, time: 0 };
let swapCache = { value: null, time: 0 };

export async function getSystemUsage(path = '/') {
  const now = Date.now();

  if (now - cpuCache.time > 1000) {
    cpuCache = { value: getRawCpuUsage(), time: now };
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
  };
}
