import { _getAjax, _postAjax } from '../js/utils/utils';
// 获取便条
export function reqGetNotePad(data) {
  return _getAjax('/notepad', data);
}
// 保存
export function reqNotePad(data) {
  return _postAjax('/notepad', data);
}
