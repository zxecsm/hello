import './env.js';
import { resolve, dirname } from 'path';
import _path from '../utils/common/path.js';
import nanoid from '../utils/common/nanoid.js';
import { getDirname } from '../utils/common/utils.js';

const __dirname = getDirname(import.meta);

// 打包成单文件可执行程序后，__dirname 位于只读快照内，
// 数据目录改为可执行文件所在目录；也可用 HELLO_DATA_DIR 指定。
const appRootDir = process.pkg ? dirname(process.execPath) : resolve(__dirname, '../..');

const appDataDir = _path.toUnixPath(
  process.env.HELLO_DATA_DIR
    ? resolve(process.env.HELLO_DATA_DIR)
    : resolve(appRootDir, 'app_data'),
);

const envPort = Number.parseInt(process.env.PORT, 10);
const port = envPort > 0 && envPort <= 65535 ? envPort : 55555;

const appConfig = {
  appFlag: nanoid(),
  // 服务端口，默认 55555；容器部署时 ports 映射要同步修改
  port,
  // 监听地址：默认所有网卡（:: 双栈，IPv4 / IPv6 都可访问），
  // 系统不支持 IPv6 时自动回退到 0.0.0.0。
  // 只想本机访问时设置 HOST=127.0.0.1（或 HOST=::1）
  host: process.env.HOST || '::',
  appName: 'hello',
  textFileHistoryDirName: '.h_history',
  adminAccount: 'root',
  adminUsername: 'admin',
  notifyAccount: 'hello',
  notifyAccountDes: '服务通知',
  ownAccountDes: '文件传输助手',
  trashDirName: '.h_trash',
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
  fileEditingDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'file_editing'), ...arg);
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
  backupDir(account, ...arg) {
    return _path.normalizeNoSlash(this.configDir(account, 'backup'), ...arg);
  },
};

export default appConfig;
