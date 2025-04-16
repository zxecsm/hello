import os from 'os';

// 获取 CPU 占用百分比
export const getCpuUsage = (() => {
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
    const cpuUsagePercent = ((totalDiff - idleDiff) / totalDiff) * 100;

    // 更新上次的 CPU 时间
    prevIdle = totalIdle;
    prevTotal = totalTick;

    return cpuUsagePercent;
  };
})();

// 获取内存占用百分比
export const getMemoryUsage = () => {
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
