import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import { parseArrayJson } from '../../utils/utils.js';
// 读取SSH配置
export async function readQuickCommands(account) {
  const configPath = appConfig.sshConfigDir(account, 'quick.json');
  return parseArrayJson((await _f.readFile(configPath, null, '')).toString(), [
    {
      id: 'default',
      title: '默认',
      commands: [],
    },
  ]);
}

// 写入SSH配置
export async function writeQuickCommands(account, config) {
  const configPath = appConfig.sshConfigDir(account, 'quick.json');
  return _f.writeFile(configPath, JSON.stringify(config, null, 2));
}

// 分组移动位置
export async function quickGroupMoveLocation(account, fId, tId) {
  if (fId === tId) return;

  const list = await readQuickCommands(account);

  const fIdx = list.findIndex((item) => item.id === fId),
    tIdx = list.findIndex((item) => item.id === tId);

  if (fIdx > 0 && tIdx > 0 && fIdx !== tIdx) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));
    await writeQuickCommands(account, list);
  }
}

// 快捷命令移动位置
export async function quickMoveLocation(account, groupId, fromId, toId) {
  if (fromId === toId) return;

  const list = await readQuickCommands(account);

  const idx = list.findIndex((item) => item.id === groupId);

  if (idx >= 0) {
    const fIdx = list[idx].commands.findIndex((item) => item.id === fromId),
      tIdx = list[idx].commands.findIndex((item) => item.id === toId);

    if (fIdx < 0 || tIdx < 0 || fIdx === tIdx) return;

    list[idx].commands.splice(tIdx, 0, ...list[idx].commands.splice(fIdx, 1));

    await writeQuickCommands(account, list);
  }
}
