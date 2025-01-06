import os from 'os';

const userHome = os.homedir().replace(/\\/g, '/'); // 系统用户家目录

const appData = `${userHome}/helloData`; // 应用数据存放目录
const appFiles = `${userHome}/helloFiles`; // 应用文件管理器管理员根目录

const appConfig = {
  port: 55555,
  appData,
  appFiles,
  userFiles: `${appData}/userFiles`,
};

export default appConfig;
