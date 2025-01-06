import { _getAjax, _postAjax, _upFile } from '../js/utils/utils';

// 更新最后播放歌曲
export function reqPlayerLastPlay(data) {
  return _postAjax('/player/last-play', data, { load: false, stopErrorMsg: 1 });
}
// 获取最后播放
export function reqPlayerGetLastPlay() {
  return _getAjax('/player/last-play');
}
// 歌词
export function reqPlayerLrc(data) {
  return _getAjax('/player/lrc', data);
}
// 编辑歌词
export function reqPlayerEditLrc(data) {
  return _postAjax('/player/edit-lrc', data);
}
// 取消收藏
export function reqPlayerCloseCollectSong(data) {
  return _postAjax('/player/close-collect-song', data);
}
// 收藏歌曲
export function reqPlayerCollectSong(data) {
  return _postAjax('/player/collect-song', data);
}
// 分享歌曲
export function reqPlayerShare(data) {
  return _postAjax('/player/share', data);
}
// 删除歌曲
export function reqPlayerDeleteSong(data) {
  return _postAjax('/player/delete-song', data);
}
// 移动歌曲
export function reqPlayerSongToList(data) {
  return _postAjax('/player/song-to-list', data);
}
// 编辑歌曲
export function reqPlayerEditSong(data) {
  return _postAjax('/player/edit-song', data);
}
// 获取歌曲信息
export function reqPlayerSongInfo(data) {
  return _getAjax('/player/song-info', data);
}
// 删除mv
export function reqPlayerDeleteMv(data) {
  return _postAjax('/player/delete-mv', data);
}
// 移动歌单
export function reqPlayerMoveList(data) {
  return _postAjax('/player/move-list', data);
}
// 歌单列表
export function reqPlayerList(data) {
  return _getAjax('/player/list', data);
}
// 播放列表
export function reqPlayerGetPlayList() {
  return _getAjax('/player/playlist');
}
// 播放列表
export function reqPlayerPlayList(data) {
  return _postAjax('/player/playlist', data);
}
// 添加歌单
export function reqPlayerAddList(data) {
  return _postAjax('/player/add-list', data);
}
// 编辑歌单
export function reqPlayerEditList(data) {
  return _postAjax('/player/edit-list', data);
}
// 上传
export function reqPlayerUp(data, file, cb, signal) {
  return _upFile(`/player/up`, data, file, cb, signal);
}
// 重复
export function reqPlayerRepeat(data) {
  return _postAjax('/player/repeat', data, { parallel: true });
}
// 移动歌曲
export function reqPlayerMoveSong(data) {
  return _postAjax('/player/move-song', data);
}
// 搜索
export function reqPlayerSearch(data) {
  return _getAjax('/player/search', data);
}
// 读取歌词
export function reqPlayerReadLrc(data) {
  return _getAjax('/player/read-lrc', data);
}
// 删除歌单
export function reqPlayerDeleteList(data) {
  return _postAjax('/player/delete-list', data);
}
// 读取分享
export function reqPlayerGetShare(data) {
  return _getAjax('/player/share', data);
}
// 保存分享
export function reqPlayerSaveShare(data) {
  return _postAjax('/player/save-share', data);
}
// 随机200
export function reqPlayerRandomList() {
  return _getAjax('/player/random-list');
}
// 导入歌曲
export function reqPlayerImport(data) {
  return _postAjax('/player/import', data);
}
// 导出歌单
export function reqPlayerExport(data) {
  return _postAjax('/player/export', data);
}
