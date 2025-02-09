import { _getAjax, _postAjax } from '../js/utils/utils';
// 读取笔记
export function reqNoteRead(data) {
  return _getAjax('/note/read', data);
}
// 编辑笔记
export function reqNoteEdit(data) {
  return _postAjax('/note/edit', data);
}
// 上传笔记
export function reqNoteUpNote(data, callback, signal) {
  return _postAjax(
    '/note/up-note',
    data,
    { signal, load: false, parallel: true },
    callback
  );
}
// 删除
export function reqNoteDelete(data) {
  return _postAjax('/note/delete', data);
}
// 锁定
export function reqNoteState(data) {
  return _postAjax('/note/state', data);
}
// 搜索
export function reqNoteSearch(data) {
  return _postAjax('/note/search', data);
}
// 置顶
export function reqNoteTop(data) {
  return _postAjax('/note/top', data);
}
// 笔记设置分类
export function reqNoteSetCategory(data) {
  return _postAjax('/note/set-category', data);
}
// 添加分类
export function reqNoteAddCategory(data) {
  return _postAjax('/note/add-category', data);
}
// 获取分类列表
export function reqNoteCategory(data) {
  return _getAjax('/note/category', data);
}
// 删除分类
export function reqNoteDeleteCategory(data) {
  return _getAjax('/note/delete-category', data);
}
// 编辑分类
export function reqNoteEditCategory(data) {
  return _postAjax('/note/edit-category', data);
}
// 编辑笔记信息
export function reqNoteEditInfo(data) {
  return _postAjax('/note/edit-info', data);
}
