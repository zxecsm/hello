// ip地理位置
const IP2Region = require('ip2region').default;
const queryIP = new IP2Region();

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
    // eslint-disable-next-line no-unused-vars
  } catch (error) {}
  return res;
}

module.exports = getCity;
