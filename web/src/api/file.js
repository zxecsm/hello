import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';
// 读取目录
export function reqFileReadDir(data) {
  return _getAjax('/file/read-dir', data);
}
// 读取文件
export function reqFileReadFile(data) {
  return _getAjax('/file/read-file', data);
}
// 保存文件
export function reqFileSaveFile(data) {
  return _postAjax('/file/save-file', data);
}
// 权限
export function reqFileMode(data) {
  return _postAjax('/file/mode', data);
}
// 分享
export function reqFileShare(data) {
  return _postAjax('/file/share', data);
}
// 解压
export function reqFileUnZip(data) {
  return _postAjax('/file/unzip', data, { timeout: 10000 });
}
// 压缩
export function reqFileZip(data) {
  return _postAjax('/file/zip', data, { timeout: 10000 });
}
// 重复
export function reqFileRepeat(data) {
  return _postAjax('/file/repeat', data);
}
// 断点
export function reqFileBreakpoint(data) {
  return _postAjax('/file/breakpoint', data);
}
// 上传
export function reqFileUp(data, file, cb) {
  return _upFile(`/file/up`, data, file, cb);
}
// 合并
export function reqFileMerge(data) {
  return _postAjax('/file/merge', data, { timeout: 10000 });
}
// 创建文件
export function reqFileCreateFile(data) {
  return _postAjax('/file/create-file', data);
}
// 创建目录
export function reqFileCreateDir(data) {
  return _postAjax('/file/create-dir', data);
}
// 复制
export function reqFileCopy(data) {
  return _postAjax('/file/copy', data, { timeout: 10000 });
}
// 移动
export function reqFileMove(data) {
  return _postAjax('/file/move', data, { timeout: 10000 });
}
// 删除
export function reqFileDelete(data) {
  return _postAjax('/file/delete', data);
}
// 重命名
export function reqFileRename(data) {
  return _postAjax('/file/rename', data);
}
// 获取分享数据
export function reqFileGetShare(data) {
  return _getAjax('/file/share', data);
}
// 读取目录大小
export function reqFileReadDirSize(data) {
  return _getAjax('/file/read-dir-size', data);
}
