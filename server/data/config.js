import os from 'os';

const filepath = `${os.homedir()}/hello`; // 网站数据存放目录
const rootP = os.homedir(); // 文件管理器根目录
const configObj = {
  port: 55555,
  filepath,
  rootP,
  userFileP: `${filepath}/userFile`,
};
export default configObj;
