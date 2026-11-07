import net from 'node:net';

const isValid = (ip) => net.isIP(ip) !== 0;

// 归一化 IP：去空白、IPv6 方括号、zone id、IPv4-mapped 前缀
const clean = (ip) =>
  typeof ip === 'string'
    ? ip
        .trim()
        .replace(/^\[(.*)\]$/, '$1')
        .replace(/%.*$/, '')
        .replace(/^::ffff:/i, '')
        .replace(/^::1$/, '127.0.0.1')
        .toLowerCase()
    : '';

// 解析 TRUST_PROXY 环境变量，交给 express 的 trust proxy 处理：
//   未设置 / 0 / off / false / no / none -> 不信任任何代理头（默认）
//   1 / proxy / true / on / yes / all     -> 信任直连的 1 层代理
//                                           （true 等旧值不再信任整条 XFF）
//   2 / 3 ...                             -> 信任 N 层代理
//   IP / CIDR / 逗号分隔列表               -> 只信任指定代理
//   loopback                              -> 等价于 127.0.0.1,::1
export function getTrustProxy(value = process.env.TRUST_PROXY) {
  if (value === undefined || value === null) return false;

  const raw = String(value).trim();
  const lower = raw.toLowerCase();

  if (!raw || ['0', 'false', 'off', 'no', 'none'].includes(lower)) return false;

  // 简化：true / all / on / yes 统一按“一层代理”处理，避免信任客户端可伪造的整条 XFF
  if (['1', 'proxy', 'true', 'on', 'yes', 'all'].includes(lower)) return 1;

  if (lower === 'loopback') return '127.0.0.1,::1';

  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    return hops > 0 ? hops : false;
  }

  return raw;
}

// 直连对端是否为受信代理（由 express 的 trust proxy 配置决定）
function isTrustedProxy(req, socketIp) {
  const trust = req?.app?.get?.('trust proxy fn');

  if (typeof trust !== 'function' || !socketIp) return false;

  try {
    return trust(socketIp, 0) === true;
  } catch {
    return false;
  }
}

const getClientIp = (req) => {
  try {
    const headers = req?.headers ?? {};
    const socketIp = clean(req?.socket?.remoteAddress ?? req?.connection?.remoteAddress ?? '');

    // req.ip 由 express 按 trust proxy 计算：
    // 未信任代理时等于直连地址；信任代理时是 X-Forwarded-For 中第一个不可信地址
    const ip = clean(req?.ip ?? '');

    // 解析出的地址与直连地址不同，说明确实经过了受信代理
    if (isValid(ip) && ip !== socketIp) return ip;

    // 兼容只设置 X-Real-IP、不设置 X-Forwarded-For 的反向代理。
    // 仅在直连对端是受信代理时才读取，直连客户端无法通过该头伪造 IP。
    if (!headers['x-forwarded-for'] && isTrustedProxy(req, socketIp)) {
      const realIp = clean(headers['x-real-ip']);

      if (isValid(realIp)) return realIp;
    }

    if (isValid(ip)) return ip;
    if (isValid(socketIp)) return socketIp;
  } catch {}

  return '0.0.0.0';
};

getClientIp.isIp = isValid;
getClientIp.clean = clean;
getClientIp.getTrustProxy = getTrustProxy;

export default getClientIp;
