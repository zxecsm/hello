import { reqUserError, reqUserGetRealTime, reqUserRealTime } from '../../../api/user';

const realtime = {
  flag: '',
  title: '',
  cbs: [],
  init(val = '') {
    this.title = val;
    this.read();
    return this;
  },
  read() {
    reqUserGetRealTime({ flag: this.flag, page: this.title })
      .then((res) => {
        this.flag = res.data.flag; // 更新标识
        if (res.code === 1) {
          try {
            this.cbs.forEach((cb) => cb && cb(res.data.msgs));
          } catch (error) {
            reqUserError(error);
          }
        }
        this.read();
      })
      .catch(() => {
        let timer = setTimeout(() => {
          clearTimeout(timer);
          timer = null;
          this.read();
        }, 5000);
      });
  },
  add(cb) {
    this.cbs.push(cb);
    return this;
  },
  send(data) {
    //发送指令
    reqUserRealTime(data)
      .then(() => {})
      .catch(() => {});
  },
};
export default realtime;
