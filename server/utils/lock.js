class Lock {
  constructor() {
    this.isLocked = false;
    this.waitingQueue = [];
  }

  // 获取锁
  acquire() {
    return new Promise((resolve) => {
      // 定义一个解锁函数
      const unLock = () => {
        this.isLocked = false;
        // 解锁后，队列如果有任务，锁定并执行下一个任务
        if (this.waitingQueue.length > 0) {
          this.isLocked = true;
          this.waitingQueue.shift()(unLock);
        }
      };

      if (this.isLocked) {
        // 如果有锁，把 resolve 放入队列
        this.waitingQueue.push(resolve);
      } else {
        // 如果没有锁，锁定后返回解锁函数
        this.isLocked = true;
        resolve(unLock);
      }
    });
  }
}

export default Lock;
