import { reqUserError, reqUserGetRealTime, reqUserRealTime } from '../../../api/user';
import { isIframe } from '../../utils/utils';
import _d from '../../common/config';
import { isMessageForClient } from './route';

// 与外壳通信的标识
export const RT_KEY = '__helloRt';

// 实时消息
// 两种模式：
// - owner：顶层页面（home 或单独打开的标签页），唯一持有长轮询
// - follower：iframe 里的页面，不建立请求，由外壳统一收消息后转发
const realtime = {
  flag: '', // 消息游标（断线重连后用于补发）
  title: '', // 当前页面的标识（page 参数）
  cbs: [], // 消息回调
  mode: 'idle', // idle | owner | follower
  gen: 0, // 代际，用于作废旧的长轮询循环
  retryTimer: null, // 失败重试定时器
  startTimer: null, // 重连合并定时器
  temids: [], // owner：本浏览上下文树内所有窗口的客户端ID
  pages: new Map(), // owner：temid -> 页面标识
  forwarders: [], // owner：消息转发给窗口的回调
  parentBound: false, // follower：是否已监听外壳消息
  acked: false, // follower：外壳是否已确认登记
  helloTries: 0, // follower：hello 重试次数

  init(val = '') {
    this.title = val;
    if (isIframe()) {
      this.beFollower();
    } else {
      this.beOwner();
    }
    return this;
  },
  add(cb) {
    this.cbs.push(cb);
    return this;
  },
  // 发送指令：始终从当前页面直连 POST，不经过外壳
  send(data) {
    reqUserRealTime(data)
      .then(() => {})
      .catch(() => {});
  },
  // 注册消息转发器（由外壳的窗口管理器使用）
  onForward(fn) {
    if (typeof fn === 'function' && !this.forwarders.includes(fn)) {
      this.forwarders.push(fn);
    }
  },

  // ------------------------- owner -------------------------
  beOwner() {
    if (this.mode === 'owner') return;
    this.mode = 'owner';
    this.temids = [_d.temid];
    this.pages = new Map([[_d.temid, this.pageName()]]);
    this.start();
  },
  pageName() {
    return this.title || window._pageName || 'home';
  },
  // temids 变化后立即用新参数重连，避免新窗口的消息被旧连接漏掉
  start() {
    this.gen++;
    if (this.gen > 10000) {
      this.gen = 0;
    }
    this.clearRetry();
    // 合并同一轮内的多次变更（例如批量关闭窗口），避免连续发请求
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      this.loop(this.gen);
    }, 0);
  },
  clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  },
  loop(gen) {
    if (gen !== this.gen) return;
    reqUserGetRealTime({
      flag: this.flag,
      page: this.pageName(),
      pages: [...new Set(this.pages.values())].join(','),
      temids: this.temids.join(','),
    })
      .then((res) => {
        // 已被新一轮请求取代，丢弃本次结果（不更新 flag，下轮会重新取到）
        if (gen !== this.gen) return;
        const data = res.data || {};
        this.flag = data.flag || this.flag;
        if (res.code === 1 && Array.isArray(data.msgs) && data.msgs.length) {
          this.dispatch(data.msgs);
        }
        this.loop(gen);
      })
      .catch(() => {
        if (gen !== this.gen) return;
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.loop(gen);
        }, 5000);
      });
  },
  // 分发：本地页面消费 + 交给窗口管理器转发
  // 页面拿到的是 { from, to, data }，from 是发送方 temid，to 见 route.js
  dispatch(list) {
    const mine = [];
    const myTemid = _d.temid;

    list.forEach((item) => {
      if (isMessageForClient(item.from, item.to, myTemid)) {
        mine.push(item);
      }
    });
    if (mine.length) this.emit(mine);
    if (list.length) {
      this.forwarders.forEach((fn) => {
        try {
          fn(list);
        } catch (error) {
          reqUserError(error);
        }
      });
    }
  },
  emit(msgs) {
    this.cbs.forEach((cb) => {
      try {
        cb && cb(msgs);
      } catch (error) {
        reqUserError(error);
      }
    });
  },
  // 窗口注册：拿到 iframe 的 temid 和页面标识
  // oldTemid：页面刷新后 temid 会变，顺手把旧的移出，避免列表无限增长
  addTemid(temid, page, oldTemid = '') {
    if (!temid) return;
    let changed = false;
    if (oldTemid && oldTemid !== temid && this.temids.includes(oldTemid)) {
      this.temids = this.temids.filter((item) => item !== oldTemid);
      this.pages.delete(oldTemid);
      changed = true;
    }
    const known = this.temids.includes(temid);
    const oldPage = this.pages.get(temid);
    if (!known) this.temids.push(temid);
    this.pages.set(temid, page || '');
    if (changed || !known || oldPage !== page) this.start();
  },
  // 窗口关闭：移出转发列表
  removeTemid(temid) {
    if (!temid || !this.temids.includes(temid)) return;
    this.temids = this.temids.filter((item) => item !== temid);
    this.pages.delete(temid);
    this.start();
  },

  // ------------------------- follower -------------------------
  beFollower() {
    if (this.mode === 'follower') return;
    this.mode = 'follower';
    if (!this.parentBound) {
      this.parentBound = true;
      window.addEventListener('message', this.onParentMessage);
    }
    // 把自己登记到外壳（temid 用于 self 消息的定向转发）
    this.hello();
  },
  // 外壳没确认就重试，避免登记消息丢在监听的空窗期
  hello() {
    if (this.acked) return;
    this.post({ act: 'hello', temid: _d.temid, page: this.pageName() });
    if (this.helloTries >= 3) return;
    this.helloTries++;
    setTimeout(() => this.hello(), 800);
  },
  onParentMessage(e) {
    if (e.origin !== location.origin) return;
    const data = e.data;
    if (!data || data.rt !== RT_KEY) return;
    if (data.act === 'hello-ack') {
      realtime.acked = true;
      return;
    }
    if (data.act !== 'msgs') return;
    if (!Array.isArray(data.msgs) || !data.msgs.length) return;
    realtime.emit(data.msgs);
  },
  post(msg) {
    try {
      parent.postMessage({ ...msg, rt: RT_KEY }, location.origin);
    } catch {}
  },
};

export default realtime;
