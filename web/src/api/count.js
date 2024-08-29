import { _getAjax, _postAjax } from '../js/utils/utils';

// 获取列表
export function reqCountList(data) {
  return _getAjax('/count/list', data);
}
// 新增
export function reqCountAdd(data) {
  return _postAjax('/count/add', data);
}
// 删除
export function reqCountDelete(data) {
  return _postAjax('/count/delete', data);
}
// 编辑
export function reqCountEdit(data) {
  return _postAjax('/count/edit', data);
}
// 权重
export function reqCountTop(data) {
  return _postAjax('/count/top', data);
}
// 状态
export function reqCountState(data) {
  return _postAjax('/count/state', data);
}
