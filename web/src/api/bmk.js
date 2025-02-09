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
export function reqBmkMoveGroup(data) {
  return _postAjax('/bmk/move-group', data);
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
export function reqBmkAddGroup(data) {
  return _postAjax('/bmk/add-group', data);
}
// 删除书签
export function reqBmkDeleteBmk(data) {
  return _postAjax('/bmk/delete-bmk', data);
}
// 移动书签到分组
export function reqBmkToGroup(data) {
  return _postAjax('/bmk/bmk-to-group', data);
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
export function reqBmkEditGroup(data) {
  return _postAjax('/bmk/edit-group', data);
}
// 分享分组
export function reqBmkShare(data) {
  return _postAjax('/bmk/share', data);
}
// 删除分组
export function reqBmkDeleteGroup(data) {
  return _postAjax('/bmk/delete-group', data);
}
// 分组状态
export function reqBmkGroupShareState(data) {
  return _postAjax('/bmk/group-share-state', data);
}
// 删除书签logo
export function reqBmkDeleteLogo(data) {
  return _getAjax('/bmk/delete-logo', data);
}
// 书签移动位置
export function reqBmkEditBmk(data) {
  return _postAjax('/bmk/edit-bmk', data);
}
// 搜索
export function reqBmkSearch(data) {
  return _postAjax('/bmk/search', data);
}
// 获取分享数据
export function reqBmkGetShare(data) {
  return _postAjax('/bmk/get-share', data);
}
// 保存分享
export function reqBmkSaveShare(data) {
  return _postAjax('/bmk/save-share', data);
}
