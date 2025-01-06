// ip地理位置
import IP2Region from 'ip2region';
const queryIP = new IP2Region.default();

function getCity(ip) {
  const res = { country: '**', province: '**', city: '**', isp: '**' };
  try {
    const obj = queryIP.search(ip);
    Object.keys(res).forEach((key) => {
      const value = obj[key];
      if (value) {
        res[key] = value;
      }
    });
  } catch {}
  return res;
}

export default getCity;
