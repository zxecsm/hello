import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';
// 上传
export function reqPicUp(data, file, cb, signal) {
  return _upFile(`/pic/up`, data, file, cb, signal);
}
// 重复
export function reqPicRepeat(data) {
  return _postAjax('/pic/repeat', data, { parallel: true });
}
// 列表
export function reqPicList(data) {
  return _getAjax('/pic/list', data);
}
// 删除
export function reqPicDelete(data) {
  return _postAjax('/pic/delete', data);
}
