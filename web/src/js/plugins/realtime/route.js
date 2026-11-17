// 消息投递规则：判断一条实时消息是否应该交给某个客户端
// 服务端下发的消息格式：{ from: 发送方客户端ID, to: 投递目标, data: 消息内容 }
// to 取值：
// - 'all'   广播给所有页面
// - 'other' 广播给除发送方以外的页面
// - 'self'  只给发送方
// - 其他    定向到某个客户端ID
export function isMessageForClient(from, to, temid) {
  if (to === 'all') return true;
  if (to === 'self') return from === temid;
  if (to === 'other') return from !== temid;
  return to === temid;
}
