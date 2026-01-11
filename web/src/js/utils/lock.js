export class Lock {
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

  // 释放锁
  isFree() {
    return !this.isLocked && this.waitingQueue.length === 0;
  }
}

// 全局锁表： flag -> Lock 实例
const lockMap = new Map();

// 获取某个 flag 的锁
export async function lock(flag) {
  if (!lockMap.has(flag)) {
    lockMap.set(flag, new Lock());
  }

  const locker = lockMap.get(flag);
  const unLock = await locker.acquire();

  // 包一层，自动清理无用锁
  return () => {
    unLock();

    // 如果没有在等待了，就移除
    if (locker.isFree()) {
      lockMap.delete(flag);
    }
  };
}

// 带作用域的锁
export async function withLock(flag, fn) {
  const unLock = await lock(flag);
  try {
    return await fn();
  } finally {
    unLock();
  }
}
