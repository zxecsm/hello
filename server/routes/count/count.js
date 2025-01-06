export function computerDay(start, end) {
  const total = end - start; // 总时间
  let past = Date.now() - start; // 过去
  // past > total ? (past = total) : past < 0 ? (past = 0) : null;
  const percent = parseInt((past / total) * 100); // 百分比
  const remain = total - past; // 剩下
  return { total, past, remain, percent };
}
