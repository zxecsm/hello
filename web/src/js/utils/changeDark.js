// 监听黑暗模式的变化
try {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      changeDark.cbs.forEach((item) => {
        item && item(event.matches);
      });
    });
  // eslint-disable-next-line no-unused-vars
} catch (error) {}
const changeDark = {
  cbs: [],
  bind(cb) {
    this.cbs.push(cb);
  },
};
export default changeDark;
