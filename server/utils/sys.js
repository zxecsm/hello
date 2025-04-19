import os from 'os';

// 获取 CPU 占用百分比
const getRawCpuUsage = (() => {
  // 记录上一次的 CPU 时间
  let prevIdle = 0;
  let prevTotal = 0;
  return () => {
    const cpus = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    // 计算 CPU 使用率
    const totalDiff = totalTick - prevTotal;
    const idleDiff = totalIdle - prevIdle;

    // 更新上次的 CPU 时间
    prevIdle = totalIdle;
    prevTotal = totalTick;

    if (totalDiff === 0) return 0;
    return ((totalDiff - idleDiff) / totalDiff) * 100;
  };
})();

// 获取内存占用百分比
const getRawMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    usedPercent: (used / total) * 100,
  };
};

let lastFetchTime = 0;
let cachedResult = null;

export const getSystemUsage = () => {
  const now = Date.now();
  if (cachedResult && now - lastFetchTime < 1000) {
    return cachedResult;
  }

  cachedResult = { cpu: getRawCpuUsage(), memory: getRawMemoryUsage() };
  lastFetchTime = now;

  return cachedResult;
};
