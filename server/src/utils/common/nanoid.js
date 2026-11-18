import { randomInt } from 'node:crypto';

const to36 = (num) => num.toString(36).padStart(2, '0');

// 2 位 base36 随机串
const random2 = () => to36(randomInt(0, 1296));

// 4 位 base36 随机串（约 20.7 bit）
const random4 = () => random2() + random2();

// 2 位 base36 计数器的最大值：36^2 - 1 = 1295
const MAX_COUNT = 1295;

let lastMs = 0;
let count = 0;

// 每个进程初始化时生成一次服务 ID
const SERVICE_ID = random2();

// 生成 ID：
// - 新的一毫秒：计数器归零，后缀使用随机数
// - 同一毫秒内并发：计数器自增 1，2 位 base36 最多 1296 个
// - 计数器用完：时间戳自增，计数器归零，继续自增
// - 2 位 SERVICE_ID + 4 位随机后缀：跨进程/重启防碰撞
const nanoid = () => {
  const now = Date.now();

  if (now > lastMs) {
    lastMs = now;
    count = 0;
  } else {
    count++;

    if (count > MAX_COUNT) {
      count = 0;
      lastMs++;
    }
  }

  return `h${lastMs.toString(36)}${SERVICE_ID}${to36(count)}${random4()}`.toUpperCase();
};

export default nanoid;
