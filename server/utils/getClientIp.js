import net from 'node:net';

const isValid = (ip) => net.isIP(ip) !== 0;

const clean = (ip) =>
  ip
    ?.trim()
    .replace(/^::ffff:/, '')
    .replace(/^::1$/, '127.0.0.1') || '';

const getClientIp = (req) => {
  try {
    const headers = req?.headers ?? {};

    const list = [
      ...(headers['x-forwarded-for']?.split(',') ?? []),
      headers['x-real-ip'],
      req?.ip,
      req?.connection?.remoteAddress,
      req?.socket?.remoteAddress,
      req?.connection?.socket?.remoteAddress,
    ];

    for (const ip of list.map(clean)) if (isValid(ip)) return ip;
  } catch {}
  return '0.0.0.0';
};

getClientIp.isIp = isValid;

export default getClientIp;
