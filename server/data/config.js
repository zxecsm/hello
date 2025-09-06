import os from 'os';

const userHome = os.homedir().replace(/\\/g, '/'); // 系统用户家目录

const appData = `${userHome}/helloData`; // 应用数据存放目录
const appFiles = `${userHome}/helloFiles`; // 应用文件管理器管理员根目录

const appConfig = {
  port: 55555,
  appData,
  appFiles,
  userFiles: `${appData}/userFiles`,
  trashDirName: '.trash', // 垃圾回收站目录名
  noteHistoryDirName: '.noteHistory', // 笔记历史记录目录名
  textFileHistoryDirName: '.history', // 文本文件历史记录目录名
  helloDes: '服务通知',
  userDes: '文件传输助手',
};

export default appConfig;
