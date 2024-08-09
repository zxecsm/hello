import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';

// 获取通知
export function reqChatNews() {
  return _getAjax('/chat/news');
}
// 获取消息
export function reqChatReadMsg(data) {
  return _getAjax('/chat/read-msg', data);
}
// 清空消息
export function reqChatDeleteMsg(data) {
  return _postAjax('/chat/delete-msg', data);
}
// 用户列表
export function reqChatUserList(data) {
  return _getAjax('/chat/user-list', data);
}
// 设置用户备注
export function reqChatSetDes(data) {
  return _postAjax('/chat/setdes', data);
}
// 获取备注
export function reqChatGetDes(data) {
  return _getAjax('/chat/getdes', data);
}
// 文件过期
export function reqChatExpired(data) {
  return _getAjax('/chat/expired', data);
}
// 发送消息
export function reqChatSendMsg(data) {
  return _postAjax('/chat/send-msg', data);
}
// 发送文件
export function reqChatUp(data, file, cb) {
  return _upFile(`/chat/up`, data, file, cb);
}
// 发送语音
export function reqChatUpVoice(data, file, cb) {
  return _upFile(`/chat/up-voice`, data, file, cb);
}
// 合并文件
export function reqChatMerge(data) {
  return _postAjax('/chat/merge', data, { timeout: 5000 });
}
// 断点
export function reqChatBreakpoint(data) {
  return _postAjax('/chat/breakpoint', data);
}
// 重复
export function reqChatRepeat(data) {
  return _postAjax('/chat/repeat', data);
}
// 转发信息
export function reqChatforward(data) {
  return _postAjax('/chat/forward', data);
}
