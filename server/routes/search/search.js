import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import { parseObjectJson } from '../../utils/utils.js';

// 读取搜索引擎和翻译接口配置
export async function readSearchConfig(account) {
  const searchConfigPath = appConfig.searchConfigDir(account, 'config.json');
  return parseObjectJson(
    (await _f.readFile(searchConfigPath, null, '')).toString(),
    {}
  );
}

// 写入搜索引擎和翻译接口配置
export async function writeSearchConfig(account, config) {
  const searchConfigPath = appConfig.searchConfigDir(account, 'config.json');
  return _f.writeFile(searchConfigPath, JSON.stringify(config, null, 2));
}
