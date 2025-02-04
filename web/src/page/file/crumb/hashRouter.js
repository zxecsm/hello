import _path from '../../../js/utils/path';

class HashRouter {
  constructor({ change, before } = {}) {
    this.change = change;
    this.before = before;
    this.routes = [];
    this.currentIndex = -1;
  }

  // 获取当前的 hash 路径
  getHash() {
    const hash = window.location.hash.slice(1);
    return _path.normalize(hash || '/');
  }

  // 更改 hash 路径
  changeHash(path, type = 'push') {
    const curRoute = this.getRoute();
    if (curRoute === path) return;

    // 调用 before 回调，传递当前路由路径
    this.before?.(curRoute);

    // 如果 before 修改了路径，防止路径不一致
    if (this.getHash() !== path) {
      window.location.hash = '#' + path;
    }

    // 更新当前历史记录索引
    if (type === 'push' || type === 'forward') {
      this.currentIndex++;
    } else if (type === 'back') {
      this.currentIndex--;
    }

    // 调用 change 回调，传递新的路由路径
    this.change?.(this.getRoute());
  }

  // 获取当前路由路径
  getRoute() {
    return this.routes[this.currentIndex];
  }

  // 推送新路径到历史记录栈
  push(path) {
    path = _path.normalize(path); // 确保路径已归一化
    if (this.getRoute() === path) return;

    // 处理栈内记录的剪裁，保留当前索引之后的历史记录
    if (this.currentIndex >= 0 && this.currentIndex < this.routes.length - 1) {
      this.routes = this.routes.slice(0, this.currentIndex + 1);
    }

    this.routes.push(path);
    this.changeHash(path, 'push');
  }

  // 返回上一条历史记录
  back() {
    if (!this.hasBack()) return;
    const path = this.routes[this.currentIndex - 1];
    this.changeHash(path, 'back');
  }

  // 检查是否有上一条历史记录
  hasBack() {
    return this.currentIndex > 0;
  }

  // 前进到下一条历史记录
  forward() {
    if (!this.hasForward()) return;
    const path = this.routes[this.currentIndex + 1];
    this.changeHash(path, 'forward');
  }

  // 检查是否有下一条历史记录
  hasForward() {
    return this.currentIndex < this.routes.length - 1;
  }
}

export default HashRouter;
