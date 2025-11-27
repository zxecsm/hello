import os from 'os';
import _path from '../utils/path.js';

const userHomeDir = _path.toUnixPath(os.homedir());

const appDataDir = `${userHomeDir}/helloApp`;

const appConfig = {
  port: 55555,
  appName: 'hello',
  textFileHistoryDirName: '.history',
  adminAccount: 'root',
  notifyAccount: 'hello',
  notifyAccountDes: '服务通知',
  ownAccountDes: '文件传输助手',
  trashDirName: '.trash',
  chatRoomAccount: 'chang',
  initUsername: 'admin',
  aboutid: 'about',
  tipsid: 'tips',

  appFilesDir(...arg) {
    return _path.normalize(
      this.configDir(this.adminAccount, 'appFiles'),
      ...arg
    );
  },
  bgDir(...arg) {
    return _path.normalize(this.appFilesDir('bg'), ...arg);
  },
  customDir(...arg) {
    return _path.normalize(this.appFilesDir('custom'), ...arg);
  },
  dataDir(...arg) {
    return _path.normalize(this.appFilesDir('data'), ...arg);
  },
  faviconDir(...arg) {
    return _path.normalize(this.appFilesDir('favicon'), ...arg);
  },
  fontDir(...arg) {
    return _path.normalize(this.appFilesDir('font'), ...arg);
  },
  logDir(...arg) {
    return _path.normalize(this.appFilesDir('log'), ...arg);
  },
  musicDir(...arg) {
    return _path.normalize(this.appFilesDir('music'), ...arg);
  },
  notepadDir(...arg) {
    return _path.normalize(this.appFilesDir('notepad'), ...arg);
  },
  picDir(...arg) {
    return _path.normalize(this.appFilesDir('pic'), ...arg);
  },
  siteinfoDir(...arg) {
    return _path.normalize(this.appFilesDir('siteinfo'), ...arg);
  },
  temDir(...arg) {
    return _path.normalize(this.appFilesDir('tem'), ...arg);
  },
  thumbDir(...arg) {
    return _path.normalize(this.appFilesDir('thumb'), ...arg);
  },
  uploadDir(...arg) {
    return _path.normalize(this.appFilesDir('upload'), ...arg);
  },
  userFilesDir(...arg) {
    return _path.normalize(this.appFilesDir('userFiles'), ...arg);
  },
  databaseDir(...arg) {
    return _path.normalize(this.dataDir('db'), ...arg);
  },

  userRootDir(account, ...arg) {
    const path =
      account === this.adminAccount ? appDataDir : this.userFilesDir(account);
    return _path.normalize(path, ...arg);
  },
  trashDir(account, ...arg) {
    return _path.normalize(
      this.userRootDir(account, this.trashDirName),
      ...arg
    );
  },
  configDir(account, ...arg) {
    return _path.normalize(this.userRootDir(account, '.h_config'), ...arg);
  },
  logoDir(account, ...arg) {
    return _path.normalize(this.configDir(account, 'logo'), ...arg);
  },
  fileConfigDir(account, ...arg) {
    return _path.normalize(this.configDir(account, 'file_config'), ...arg);
  },
  searchConfigDir(account, ...arg) {
    return _path.normalize(this.configDir(account, 'search_config'), ...arg);
  },
  noteHistoryDir(account, ...arg) {
    return _path.normalize(this.configDir(account, 'note_history'), ...arg);
  },
  pubDir(account, ...arg) {
    return _path.normalize(this.configDir(account, 'pub'), ...arg);
  },
};

export default appConfig;
