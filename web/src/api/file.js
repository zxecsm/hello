import _d from '../js/common/config';
import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';
// 读取目录
export function reqFileReadDir(data) {
  return _postAjax('/file/read-dir', data);
}
// 读取文件
export function reqFileReadFile(data) {
  return _postAjax('/file/read-file', data);
}
// 保存文件
export function reqFileSaveFile(data) {
  return _postAjax('/file/save-file', data);
}
// 权限
export function reqFileMode(data) {
  return _postAjax('/file/mode', data);
}
// 用户组
export function reqFileChown(data) {
  return _postAjax('/file/chown', data);
}
// 分享
export function reqFileShare(data) {
  return _postAjax('/file/share', data);
}
// 解压
export function reqFileUnZip(data) {
  return _postAjax('/file/unzip', data);
}
// 压缩
export function reqFileZip(data) {
  return _postAjax('/file/zip', data);
}
// 重复
export function reqFileRepeat(data) {
  return _postAjax('/file/repeat', data, { parallel: true });
}
// 断点
export function reqFileBreakpoint(data) {
  return _postAjax('/file/breakpoint', data, { parallel: true });
}
// 上传
export function reqFileUp(data, file, cb, signal) {
  return _upFile(`/file/up`, data, file, cb, signal);
}
// 合并
export function reqFileMerge(data) {
  return _postAjax('/file/merge', data, {
    timeout: _d.fieldLength.operationTimeout,
    parallel: true,
  });
}
// 创建文件
export function reqFileCreateFile(data) {
  return _postAjax('/file/create-file', data);
}
// 创建符号链接
export function reqFileCreateLink(data) {
  return _postAjax('/file/create-link', data);
}
// 创建目录
export function reqFileCreateDir(data) {
  return _postAjax('/file/create-dir', data);
}
// 复制
export function reqFileCopy(data) {
  return _postAjax('/file/copy', data);
}
// 离线下载
export function reqFileDownload(data) {
  return _postAjax('/file/download', data);
}
// 是否存在同名文件
export function reqFileSameName(data) {
  return _postAjax('/file/same-name', data);
}
// 移动
export function reqFileMove(data) {
  return _postAjax('/file/move', data);
}
// 删除
export function reqFileDelete(data) {
  return _postAjax('/file/delete', data);
}
// 清空回收站
export function reqFileClearTrash() {
  return _getAjax('/file/clear-trash');
}
// 重命名
export function reqFileRename(data) {
  return _postAjax('/file/rename', data);
}
// 获取分享数据
export function reqFileGetShare(data) {
  return _postAjax('/file/get-share', data);
}
// 读取目录大小
export function reqFileReadDirSize(data) {
  return _getAjax('/file/read-dir-size', data);
}
// 获取访问历史
export function reqFileCdHistory() {
  return _getAjax('/file/cd-history');
}
// 获取收藏目录
export function reqFileGetFavorites() {
  return _getAjax('/file/favorites');
}
// 收藏目录
export function reqFileFavorites(data) {
  return _postAjax('/file/favorites', data);
}
// 文件历史记录
export function reqFileGetHistoryState() {
  return _getAjax('/file/history-state');
}
export function reqFileHistoryState(data) {
  return _postAjax('/file/history-state', data);
}
// 扫描文件到
export function reqFileAddFileTo(data) {
  return _postAjax('/file/add-file-to', data);
}
