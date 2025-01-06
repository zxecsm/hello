import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';

// 随机壁纸
export function reqBgRandom(param) {
  return _getAjax('/bg/random', param);
}
// 更换壁纸
export function reqChangeBg(data) {
  return _postAjax('/bg/change', data);
}
// 上传壁纸
export function reqBgUp(data, file, cb, signal) {
  return _upFile(`/bg/up`, data, file, cb, signal);
}
// 重复
export function reqBgRepeat(data) {
  return _postAjax('/bg/repeat', data, { parallel: true });
}
// 删除壁纸
export function reqBgDelete(data) {
  return _postAjax('/bg/delete', data);
}
// 获取列表
export function reqBgList(data) {
  return _getAjax('/bg/list', data);
}
