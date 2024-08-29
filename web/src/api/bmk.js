import { _getAjax, _postAjax } from '../js/utils/utils';

// 导入书签
export function reqBmkImport(data) {
  return _postAjax('/bmk/import', data);
}
// 导出书签
export function reqBmkExport() {
  return _getAjax('/bmk/export');
}
// 分组移动位置
export function reqBmkMoveList(data) {
  return _postAjax('/bmk/move-list', data);
}
// 书签移动位置
export function reqBmkMoveBmk(data) {
  return _postAjax('/bmk/move-bmk', data);
}
// 列表
export function reqBmkList(data) {
  return _getAjax('/bmk/list', data);
}
// 新增分组
export function reqBmkAddList(data) {
  return _postAjax('/bmk/add-list', data);
}
// 删除书签
export function reqBmkDeleteBmk(data) {
  return _postAjax('/bmk/delete-bmk', data);
}
// 移动书签到分组
export function reqBmkToList(data) {
  return _postAjax('/bmk/bmk-to-list', data);
}
// 获取网站信息
export function reqBmkParseSiteInfo(data) {
  return _getAjax('/bmk/parse-site-info', data);
}
// 添加书签
export function reqBmkAddBmk(data) {
  return _postAjax('/bmk/add-bmk', data);
}
// 编辑分组
export function reqBmkEditList(data) {
  return _postAjax('/bmk/edit-list', data);
}
// 分享分组
export function reqBmkShare(data) {
  return _postAjax('/bmk/share', data);
}
// 删除分组
export function reqBmkDeleteList(data) {
  return _postAjax('/bmk/delete-list', data);
}
// 分组状态
export function reqBmkListState(data) {
  return _postAjax('/bmk/list-state', data);
}
// 更改书签logo
export function reqBmkChangeLogo(data) {
  return _postAjax('/bmk/change-logo', data);
}
// 书签移动位置
export function reqBmkEditBmk(data) {
  return _postAjax('/bmk/edit-bmk', data);
}
// 搜索
export function reqBmkSearch(data) {
  return _getAjax('/bmk/search', data);
}
// 获取分享数据
export function reqBmkGetShare(data) {
  return _getAjax('/bmk/share', data);
}
// 保存分享
export function reqBmkSaveShare(data) {
  return _getAjax('/bmk/save-share', data);
}
