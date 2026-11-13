// dev test
self.addEventListener('install', () => {});
self.addEventListener('fetch', () => {});
// 通知点击处理（与生产环境共用同一份实现）
importScripts('/sw-notify.js');
