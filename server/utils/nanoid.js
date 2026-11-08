import { randomInt } from 'node:crypto';

const to36 = (num) => num.toString(36).padStart(2, '0');

// 4 位 base36 随机串（约 20.7 bit）
const random4 = () => to36(randomInt(0, 1296)) + to36(randomInt(0, 1296));

let lastMs = 0;

// 每个进程初始化时生成一次服务 ID
const SERVICE_ID = random4();

// 生成 ID：
// - lastMs 严格递增：同一进程内严格不重复（不需要额外计数器）
// - 4 位 SERVICE_ID + 4 位随机后缀：跨进程/重启防碰撞
const nanoid = () => {
  const now = Date.now();

  if (now > lastMs) {
    lastMs = now;
  } else {
    lastMs++;
  }

  return `h${lastMs.toString(36)}${SERVICE_ID}${random4()}`.toUpperCase();
};

export default nanoid;
