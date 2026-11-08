const to36 = (num) => num.toString(36).padStart(2, '0');

// 使用 CSPRNG 生成 0~1295 的均匀随机数
const randomBase36 = () => {
  const buf = new Uint16Array(1);
  const limit = 1296 * 50; // 64800，拒绝 >= 64800 的值
  let value;

  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);

  return value % 1296;
};

// 4 位 base36 随机串
const random4 = () => to36(randomBase36()) + to36(randomBase36());

// 每个页面初始化时生成一次服务 ID
const SERVICE_ID = random4();

let lastMs = 0;

// 生成 ID：
// - lastMs 严格递增：同一页面内严格不重复（不需要额外计数器）
// - 4 位 SERVICE_ID + 4 位随机后缀：跨页面/进程/重启防碰撞
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
