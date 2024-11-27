import { _getAjax, _postAjax } from '../js/utils/utils';

// 获取任务信息
export function reqTaskInfo(data) {
  return _getAjax('/task/info', data, {
    stopErrorMsg: true,
    load: false,
    parallel: true,
  });
}
// 获取任务列表
export function reqTaskList(data) {
  return _getAjax('/task/list', data);
}
// 取消任务
export function reqTaskCancel(data) {
  return _postAjax('/task/cancel', data);
}
