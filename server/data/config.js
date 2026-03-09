import os from 'os';
import _path from '../utils/path.js';
import nanoid from '../utils/nanoid.js';

const userHomeDir = _path.toUnixPath(os.homedir());

const appDataDir = `${userHomeDir}/helloApp`;

const appConfig = {
  appFlag: nanoid(),
  port: 55555,
  appName: 'hello',
  textFileHistoryDirName: '.history',
  adminAccount: 'root',
  adminUsername: 'admin',
  notifyAccount: 'hello',
  notifyAccountDes: '服务通知',
  ownAccountDes: '文件传输助手',
  trashDirName: '.trash',
  chatRoomAccount: 'chang',
  initUsername: 'admin',
  aboutid: 'about',
  tipsid: 'tips',

  appFilesDir(...arg) {
    return _path.normalizeNoSlash(this.configDir(this.adminAccount, 'appFiles'), ...arg);
  },
  bgDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('bg'), ...arg);
  },
  customDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('custom'), ...arg);
  },
  dataDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('data'), ...arg);
  },
  faviconDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('favicon'), ...arg);
  },
  fontDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('font'), ...arg);
  },
  logDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('log'), ...arg);
  },
  musicDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('music'), ...arg);
  },
  notepadDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('notepad'), ...arg);
  },
  picDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('pic'), ...arg);
  },
  siteinfoDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('siteinfo'), ...arg);
  },
  temDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('tem'), ...arg);
  },
  thumbDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('thumb'), ...arg);
  },
  uploadDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('upload'), ...arg);
  },
  userFilesDir(...arg) {
    return _path.normalizeNoSlash(this.appFilesDir('userFiles'), ...arg);
  },
  databaseDir(...arg) {
    return _path.normalizeNoSlash(this.dataDir('db'), ...arg);
  },

  userRootDir(account, ...arg) {
    const path = account === this.adminAccount ? appDataDir : this.userFilesDir(account);
    return _path.normalizeNoSlash(path, ...arg);
  },
  trashDir(account, ...arg) {
    return _path.normalizeNoSlash(this.userRootDir(account, this.trashDirName), ...arg);
  },
  configDir(account, ...arg) {
    return _path.normalizeNoSlash(this.userRootDir(account, '.h_config'), ...arg);
  },
  logoDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'logo'), ...arg);
  },
  fileConfigDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'file_config'), ...arg);
  },
  sshConfigDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'ssh_config'), ...arg);
  },
  searchConfigDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'search_config'), ...arg);
  },
  noteHistoryDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'note_history'), ...arg);
  },
  pubDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'pub'), ...arg);
  },
};

export default appConfig;
