import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// 内网 / 回环 / 保留 / 链路本地 / 组播等地址
const blockList = new net.BlockList();

[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['255.255.255.255', 32],
].forEach(([address, prefix]) => blockList.addSubnet(address, prefix, 'ipv4'));

[
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['2001::', 32], // Teredo
  ['2001:10::', 28], // ORCHID
  ['2001:20::', 28], // ORCHIDv2
  ['2001:db8::', 32], // 文档地址
  ['2002::', 16], // 6to4
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([address, prefix]) => blockList.addSubnet(address, prefix, 'ipv6'));

// 归一化 IP，处理 IPv4-mapped IPv6、方括号、zone id
function normalizeIp(ip) {
  const address = String(ip)
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');

  if (net.isIP(address) === 6) {
    const dotted = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);

    if (dotted) return { address: dotted[1], family: 'ipv4' };

    const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);

    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);

      return {
        address: `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`,
        family: 'ipv4',
      };
    }
  }

  return {
    address,
    family: net.isIP(address) === 6 ? 'ipv6' : 'ipv4',
  };
}

// 是否是禁止访问的 IP
export function isBlockedIp(ip) {
  const { address, family } = normalizeIp(ip);

  if (!net.isIP(address)) return true;

  return blockList.check(address, family);
}

// 供 http.Agent / https.Agent 使用的安全 DNS 解析：
// 在真正建立连接时校验解析出的 IP，避免 DNS 重绑定
export function createSafeLookup({ allowPrivate = false } = {}) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);

      const list = Array.isArray(addresses) ? addresses : [];

      if (!list.length) return callback(new Error('目标地址无法解析'));

      if (!allowPrivate) {
        for (const item of list) {
          if (isBlockedIp(item.address)) {
            const error = new Error('SSRF blocked');
            error.code = 'ESSRF';
            return callback(error);
          }
        }
      }

      if (options.all) return callback(null, list);

      return callback(null, list[0].address, list[0].family);
    });
  };
}

// 创建带 SSRF 校验的 Agent：
// - 域名：由 lookup 在连接时解析并校验
// - IP 字面量：net.connect 会跳过 lookup，因此这里额外拦截
function createGuardedAgent(Agent) {
  const agent = new Agent({ lookup: createSafeLookup() });
  const createConnection = agent.createConnection;

  agent.createConnection = function (options, callback) {
    const host = String(options?.host || options?.hostname || '')
      .trim()
      .replace(/^\[|\]$/g, '')
      .replace(/%.*$/, '');

    if (net.isIP(host) && isBlockedIp(host)) {
      const error = new Error('SSRF blocked');
      error.code = 'ESSRF';

      if (typeof callback === 'function') {
        callback(error);
        return undefined;
      }

      throw error;
    }

    return createConnection.call(this, options, callback);
  };

  return agent;
}

export const safeHttpAgent = createGuardedAgent(http.Agent);
export const safeHttpsAgent = createGuardedAgent(https.Agent);

// 解析并校验主机，返回可用于连接的安全地址：
// - allowPrivate=true（例如 SSH root）时直接返回原主机名
// - 否则返回解析出的第一个公网 IP，避免 DNS 重绑定
export async function resolveSafeHost(host, { allowPrivate = false } = {}) {
  const raw = String(host ?? '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');

  if (!raw) {
    const error = new Error('目标地址不能为空');
    error.code = 'ESSRF';
    throw error;
  }

  if (net.isIP(raw)) {
    if (!allowPrivate && isBlockedIp(raw)) {
      const error = new Error('目标地址不允许访问');
      error.code = 'ESSRF';
      throw error;
    }

    return raw;
  }

  let addresses;

  try {
    addresses = await dns.promises.lookup(raw, { all: true });
  } catch {
    const error = new Error('目标地址无法解析');
    error.code = 'ESSRF';
    throw error;
  }

  if (!addresses || addresses.length === 0) {
    const error = new Error('目标地址无法解析');
    error.code = 'ESSRF';
    throw error;
  }

  if (!allowPrivate) {
    for (const item of addresses) {
      if (isBlockedIp(item.address)) {
        const error = new Error('目标地址不允许访问');
        error.code = 'ESSRF';
        throw error;
      }
    }
  }

  return allowPrivate ? raw : addresses[0].address;
}

// 校验 URL（协议 + 主机），返回安全连接地址
export async function assertSafeUrl(url, { allowPrivate = false } = {}) {
  let parsed;

  try {
    parsed = new URL(String(url));
  } catch {
    const error = new Error('URL 格式错误');
    error.code = 'ESSRF';
    throw error;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const error = new Error('仅支持 http/https 协议');
    error.code = 'ESSRF';
    throw error;
  }

  return resolveSafeHost(parsed.hostname, { allowPrivate });
}
