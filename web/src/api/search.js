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
// 添加搜索引擎
export function reqSearchAddEngine(data) {
  return _postAjax('/search/add-engine', data);
}
// 编辑搜索引擎
export function reqSearchEditEngine(data) {
  return _postAjax('/search/edit-engine', data);
}
// 删除搜索引擎
export function reqSearchDeleteEngine(data) {
  return _postAjax('/search/delete-engine', data);
}
// 切换搜索引擎
export function reqSearchChangeEngine(data) {
  return _postAjax('/search/change-engine', data);
}
// 删除搜索引擎LOGO
export function reqSearchDeleteEngineLogo(data) {
  return _postAjax('/search/delete-engine-logo', data);
}
// 添加翻译接口
export function reqSearchAddTranslator(data) {
  return _postAjax('/search/add-translator', data);
}
// 编辑翻译接口
export function reqSearchEditTranslator(data) {
  return _postAjax('/search/edit-translator', data);
}
// 删除翻译接口
export function reqSearchDeleteTranslator(data) {
  return _postAjax('/search/delete-translator', data);
}
// 切换翻译接口
export function reqSearchChangeTranslator(data) {
  return _postAjax('/search/change-translator', data);
}
// 删除翻译接口LOGO
export function reqSearchDeleteTranslatorLogo(data) {
  return _postAjax('/search/delete-translator-logo', data);
}
