import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';
// 用户信息
export function reqUserInfo() {
  return _getAjax('/user/userinfo');
}
// 修改用户名
export function reqUerChangename(data) {
  return _postAjax('/user/changename', data);
}
// 每日更新壁纸
export function reqUserDailyChangeBg() {
  return _getAjax('/user/daily-change-bg');
}
// 隐身
export function reqUserHideState() {
  return _getAjax('/user/hide-state');
}
// 删除头像
export function reqUserDeleteLogo() {
  return _getAjax('/user/delete-logo');
}
// 字体列表
export function reqUserFontList() {
  return _getAjax('/user/font-list');
}
// 修改密码
export function reqUserChangPd(data) {
  return _postAjax('/user/change-pd', data);
}
// 关闭账号
export function reqUserDeleteAccount(data) {
  return _postAjax('/user/delete-account', data);
}
// 批准登录
export function reqUserAllowLogin(data) {
  return _postAjax('/user/allow-code-login', data, { timeout: 15000 });
}
// 退出
export function reqUserLogout(param) {
  return _getAjax('/user/logout', param);
}
// 更新
export function reqUserUpdateTime() {
  return _getAjax('/user/update-time', {}, { load: 0, stopErrorMsg: 1 });
}
// 上传logo
export function reqUserUpLogo(data, file, cb, signal) {
  return _upFile(`/user/up-logo`, data, file, cb, signal);
}
// 同步
export function reqUserGetRealTime(data) {
  return _getAjax('/user/real-time', data, {
    load: false,
    timeout: 30 * 1000,
    stopErrorMsg: 1,
  });
}
// 发送指令
export function reqUserRealTime(data) {
  return _postAjax('/user/real-time', data, { load: false, parallel: true });
}
// 免密登录
export function reqUserCodeLogin(data) {
  return _postAjax('/user/code-login', data, { load: 0, stopErrorMsg: 1 });
}
// 登录
export function reqUserLogin(data) {
  return _postAjax('/user/login', data);
}
// 注册
export function reqUserRegister(data) {
  return _postAjax('/user/register', data);
}
// 删除分享
export function reqUserDeleteShare(data) {
  return _postAjax('/user/delete-share', data);
}
// 编辑分享
export function reqUserEditShare(data) {
  return _postAjax('/user/edit-share', data);
}
// 分享列表
export function reqUserShareList(data) {
  return _getAjax('/user/share-list', data);
}
// 回收站列表
export function reqUserTrashList(data) {
  return _getAjax('/user/trash-list', data);
}
// 恢复回收站
export function reqUserRecoverTrash(data) {
  return _postAjax('/user/recover-trash', data);
}
// 删除回收站
export function reqUserDeleteTrash(data) {
  return _postAjax('/user/delete-trash', data);
}
// 错误
export function reqUserError(err) {
  err = `[Panel error] ` + err;
  return _postAjax(
    '/user/error',
    { err },
    { load: 0, parallel: true, stopErrorMsg: 1 }
  );
}
// tips
export function reqUserTips() {
  return _getAjax('/user/tips');
}
// 设置两步验证
export function reqUserVerify(data) {
  return _postAjax('/user/verify', data);
}
// 获取密钥
export function reqUserGetVerify() {
  return _getAjax('/user/verify');
}
// 两步认证登录
export function reqUserVerifyLogin(data) {
  return _postAjax('/user/verify-login', data);
}
// 两步认证重置密码
export function reqUserResetPass(data) {
  return _postAjax('/user/reset-pass', data);
}
// 邮箱验证码
export function reqUserEmailCode(data) {
  return _getAjax('/user/mail-code', data);
}
export function reqUserBindEmailCode(data) {
  return _getAjax('/user/bind-mail-code', data);
}
// 绑定邮箱
export function reqUserBindEmail(data) {
  return _postAjax('/user/bind-email', data);
}
// 获取自定义代码
export function reqUserCustomCode() {
  return _getAjax('/user/custom-code');
}
// 获取文件token
export function reqUserFileToken(data) {
  return _getAjax('/user/file-token', data);
}
// 获取playInConfig
export function reqUserPlayerConfig() {
  return _getAjax('/user/player-config');
}
