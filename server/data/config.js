import os from 'os';

const userHome = os.homedir().replace(/\\/g, '/'); // 系统用户家目录
const filepath = `${userHome}/hello`; // 网站数据存放目录
const rootP = userHome; // 文件管理器根目录
const configObj = {
  port: 55555,
  filepath,
  rootP,
  userFileP: `${filepath}/userFile`,
};
export default configObj;
