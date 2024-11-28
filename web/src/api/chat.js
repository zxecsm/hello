import _d from '../js/common/config';
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
  return _getAjax('/chat/getdes', data, { load: false, stopErrorMsg: true });
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
export function reqChatUp(data, file, cb, signal) {
  return _upFile(`/chat/up`, data, file, cb, signal);
}
// 发送语音
export function reqChatUpVoice(data, file, cb, signal) {
  return _upFile(`/chat/up-voice`, data, file, cb, signal);
}
// 合并文件
export function reqChatMerge(data) {
  return _postAjax('/chat/merge', data, {
    timeout: _d.fieldLenght.operationTimeout,
    parallel: true,
  });
}
// 断点
export function reqChatBreakpoint(data) {
  return _postAjax('/chat/breakpoint', data, { parallel: true });
}
// 重复
export function reqChatRepeat(data) {
  return _postAjax('/chat/repeat', data, { parallel: true });
}
// 转发信息
export function reqChatforward(data) {
  return _postAjax('/chat/forward', data);
}
// 抖一下
export function reqChatShakeMsg(data) {
  return _postAjax('/chat/shake-msg', data);
}
// 修改转发消息接口
export function reqChatForwardMsgLink(data) {
  return _postAjax('/chat/forward-msg-link', data);
}
