import { _getAjax, _postAjax } from '../js/utils/utils';

// 获取待办
export function reqTodoList(data) {
  return _getAjax('/todo/list', data);
}
// 新增事项
export function reqTodoAdd(data) {
  return _postAjax('/todo/add', data);
}
// 删除事项
export function reqTodoDelete(data) {
  return _postAjax('/todo/delete', data);
}
// 编辑事项
export function reqTodoEdit(data) {
  return _postAjax('/todo/edit', data);
}
// 修改状态
export function reqTodoState(data) {
  return _getAjax('/todo/state', data);
}
