const filepath = '/opt/hello/data'; // 网站数据存放目录
const rootP = '/home'; // 文件管理器根目录
const configObj = {
  port: 55555,
  filepath,
  rootP,
  userFileP: `${filepath}/userFile`,
};
export default configObj;
