import { _getAjax, _postAjax } from '../js/utils/utils';
// 日志列表
export function reqRootLogList() {
  return _getAjax('/root/log-list');
}
// 日志
export function reqRootLog(data) {
  return _getAjax('/root/log', data);
}
// 删除日志
export function reqRootDeleteLog(data) {
  return _postAjax('/root/delete-log', data);
}
// 用户列表
export function reqRootUserList(data) {
  return _getAjax('/root/user-list', data);
}
// 状态
export function reqRootAccountState(data) {
  return _postAjax('/root/account-state', data);
}
// 删除账号
export function reqRootDeleteAccount(data) {
  return _postAjax('/root/delete-account', data);
}
// 清理音乐文件
export function reqRootCleanMusicFile() {
  return _getAjax('/root/clean-music-file');
}
// 清理壁纸文件
export function reqRootCleanBgFile() {
  return _getAjax('/root/clean-bg-file');
}
// 清理logo文件
export function reqRootCleanLogoFile() {
  return _getAjax('/root/clean-logo-file');
}
// 清理pic文件
export function reqRootCleanPicFile() {
  return _getAjax('/root/clean-pic-file');
}
// 清空回收站
export function reqRootCleanTrashFile() {
  return _getAjax('/root/clean-trash-file');
}
// 清空压缩图
export function reqRootCleanThumbFile(data) {
  return _getAjax('/root/clean-thumb-file', data);
}
// 注册状态
export function reqRootRegisterState() {
  return _postAjax('/root/register-state');
}
// 回收站状态
export function reqRootTrashState() {
  return _postAjax('/root/trash-state');
}
// 聊天文件保存时间
export function reqRootCleanChatFile(data) {
  return _postAjax('/root/clean-chat-file', data);
}
// 更新token Key
export function reqRootUpdateTokenKey() {
  return _postAjax('/root/update-tokenkey');
}
// 清理数据库
export function reqRootCleanDatabase() {
  return _postAjax('/root/clean-database');
}
// tips
export function reqRootTips(data) {
  return _postAjax('/root/tips', data);
}
// 配置发信邮箱
export function reqRootEmail(data) {
  return _postAjax('/root/email', data);
}
// 设置自定义代码
export function reqRootCustomCode(data) {
  return _postAjax('/root/custom-code', data);
}
// 测试邮件
export function reqRootTestEmail(data) {
  return _postAjax('/root/test-email', data);
}
// 测试tfa
export function reqRootTestTfa(data) {
  return _postAjax('/root/test-tfa', data);
}
