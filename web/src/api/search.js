import { _getAjax, _postAjax } from '../js/utils/utils';

// 删除搜索历史
export function reqSearchDelete(data) {
  return _postAjax('/search/delete', data);
}
// 保存搜索历史
export function reqSearchSave(data) {
  return _postAjax('/search/save', data);
}
// 搜索列表
export function reqSearchList(data) {
  return _getAjax('/search/list', data);
}
// 分词
export function reqSearchSplitWord(data) {
  return _getAjax('/search/split-word', data);
}
// 搜索配置
export function reqSearchConfig() {
  return _getAjax('/search/config');
}
// 历史记录列表
export function reqSearchHistoryList(data) {
  return _getAjax('/search/history-list', data);
}
