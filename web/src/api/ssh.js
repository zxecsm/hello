import { _getAjax, _postAjax } from '../js/utils/utils';

// 连接SSH
export function reqSSHConnect(data) {
  return _postAjax('/ssh/connect', data);
}
// 搜索
export function reqSSHSearch(data) {
  return _postAjax('/ssh/search', data);
}
// 获取分类
export function reqSSHCategory() {
  return _getAjax('/ssh/category');
}
// 删除
export function reqSSHDelete(data) {
  return _postAjax('/ssh/delete', data);
}
// 添加
export function reqSSHAdd(data) {
  return _postAjax('/ssh/add', data);
}
// 编辑
export function reqSSHEdit(data) {
  return _postAjax('/ssh/edit', data);
}
// 置顶
export function reqSSHTop(data) {
  return _postAjax('/ssh/top', data);
}
// 设置分类
export function reqSSHSetCategory(data) {
  return _postAjax('/ssh/set-category', data);
}
// 编辑分类
export function reqSSHEditCategory(data) {
  return _postAjax('/ssh/edit-category', data);
}
// 添加分类
export function reqSSHAddCategory(data) {
  return _postAjax('/ssh/add-category', data);
}
// 删除分类
export function reqSSHDeleteCategory(data) {
  return _postAjax('/ssh/delete-category', data);
}
// 获取快捷命令列表
export function reqSSHQuickList() {
  return _getAjax(`/ssh/quick-list`);
}
// 添加快捷命令
export function reqSSHAddQuick(data) {
  return _postAjax(`/ssh/add-quick`, data);
}
// 编辑快捷命令
export function reqSSHEditQuick(data) {
  return _postAjax(`/ssh/edit-quick`, data);
}
// 删除快捷命令
export function reqSSHDeleteQuick(data) {
  return _postAjax(`/ssh/delete-quick`, data);
}
// 添加快捷命令分组
export function reqSSHAddQuickGroup(data) {
  return _postAjax(`/ssh/add-quick-group`, data);
}
// 编辑快捷命令分组
export function reqSSHEditQuickGroup(data) {
  return _postAjax(`/ssh/edit-quick-group`, data);
}
// 删除快捷命令分组
export function reqSSHDeleteQuickGroup(data) {
  return _postAjax(`/ssh/delete-quick-group`, data);
}
// 移动快捷命令的位置
export function reqSSHMoveQuick(data) {
  return _postAjax(`/ssh/move-quick`, data);
}
// 移动快捷命令分组位置
export function reqSSHMoveQuickGroup(data) {
  return _postAjax(`/ssh/move-quick-group`, data);
}
// 移动快捷命令到分组
export function reqSSHMoveToGroup(data) {
  return _postAjax(`/ssh/move-to-group`, data);
}
// 获取SSH配置
export function reqSSHInfo(data) {
  return _getAjax(`/ssh/info`, data);
}
