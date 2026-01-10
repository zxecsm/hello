import { reqPlayerSongInfo } from '../../api/player';
import rMenu from '../plugins/rightMenu';
import { formatBytes, formartSongTime, formatDate, formatNum } from './utils';
// 显示歌曲信息
export function showSongInfo(
  e,
  sobj,
  token,
  loading = { start() {}, end() {} }
) {
  loading.start();
  reqPlayerSongInfo({ id: sobj.id, token })
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        const {
          title,
          artist,
          duration,
          album,
          year,
          collect_count,
          play_count,
          create_at,
        } = res.data;
        const data = [
          {
            text: title,
            beforeText: '歌曲：',
          },
          {
            text: artist,
            beforeText: '歌手：',
          },
          {
            text: album || '--',
            beforeText: '专辑：',
          },
          {
            text: year || '--',
            beforeText: '发布年份：',
          },
          {
            text: formartSongTime(duration),
            beforeText: '时长：',
          },
          {
            text: formatNum(play_count),
            beforeText: '播放量：',
          },
          {
            text: formatNum(collect_count),
            beforeText: '收藏量：',
          },
          {
            text: formatDate({
              template: `{0}-{1}-{2}`,
              timestamp: create_at,
            }),
            beforeText: '添加时间：',
          },
        ];
        data.forEach((item, idx) => {
          (item.pointer = false), (item.id = idx + 1 + '');
        });
        rMenu.selectMenu(e, data, false, '歌曲信息');
      }
    })
    .catch(() => {
      loading.end();
    });
}
// 显示书签信息
export function showBmkInfo(e, obj) {
  const { title, link, des, group_title } = obj;
  const data = [
    {
      text: title,
      beforeText: '名称：',
    },
    {
      text: link,
      beforeText: '链接：',
    },
    {
      text: des || '--',
      beforeText: '描述：',
    },
  ];
  if (group_title) {
    data.unshift({
      text: group_title,
      beforeText: '分组：',
    });
  }
  data.forEach((item, idx) => {
    (item.pointer = false), (item.id = idx + 1 + '');
  });
  rMenu.selectMenu(e, data, false, '书签信息');
}
// 显示倒计时信息
export function showCountInfo(e, obj) {
  const { start, end, link, top, state } = obj;
  const data = [
    {
      text: state === 0 ? '开启' : '关闭',
      beforeText: '状态：',
    },
    {
      text: formatDate({
        template: '{0}-{1}-{2}',
        timestamp: start,
      }),
      beforeText: '开始日期：',
    },
    {
      text: formatDate({
        template: '{0}-{1}-{2}',
        timestamp: end,
      }),
      beforeText: '结束日期：',
    },
    {
      text: top,
      beforeText: '权重：',
    },
    {
      text: link || '--',
      beforeText: '链接：',
    },
  ];
  data.forEach((item, idx) => {
    (item.pointer = false), (item.id = idx + 1 + '');
  });
  rMenu.selectMenu(e, data, false, '倒计时信息');
}
// 显示文件信息
export function showFileInfo(e, obj) {
  const data = [
    {
      text: obj.name,
      beforeText: '名称：',
    },
    {
      text:
        obj.type === 'dir'
          ? '文件夹'
          : '文件' +
            `${
              obj.type === 'file' && obj.fileType !== 'file'
                ? `(${obj.fileTypeName})`
                : ''
            }`,
      beforeText: '类型：',
    },
    {
      text:
        obj.path +
        `${
          obj.type === 'file' && obj.fileType === 'symlink'
            ? ` => ${obj.linkTarget}(${obj.linkTargetTypeName})`
            : ''
        }`,
      beforeText: '路径：',
    },
  ];
  if (obj.mode) {
    data.push(
      {
        text: obj.mode,
        beforeText: '权限：',
      },
      {
        text: obj.uid,
        beforeText: '用户ID：',
      },
      {
        text: obj.gid,
        beforeText: '用户组ID：',
      }
    );
  }
  if (obj.favorite !== undefined && obj.type === 'dir') {
    data.push({
      text: obj.favorite ? '已收藏' : '未收藏',
      beforeText: '收藏状态：',
    });
  }
  data.push(
    {
      text: obj.size ? formatBytes(obj.size) : '--',
      beforeText: '大小：',
    },
    {
      text: formatDate({
        template: '{0}-{1}-{2} {3}:{4}',
        timestamp: obj.time,
      }),
      beforeText: '更新时间：',
    }
  );
  data.forEach((item, idx) => {
    (item.pointer = false), (item.id = idx + 1 + '');
  });
  rMenu.selectMenu(e, data, false, '属性信息');
}
// 显示笔记信息
export function showNoteInfo(e, obj) {
  const { title, create_at, update_at, visit_count, top, categoryArr } = obj;
  let data = [
    {
      text: title,
      beforeText: '标题：',
    },
    {
      text: formatDate({
        template: '{0}-{1}-{2}',
        timestamp: create_at,
      }),
      beforeText: '创建：',
    },
    {
      text: formatDate({
        template: '{0}-{1}-{2}',
        timestamp: update_at,
      }),
      beforeText: '更新：',
    },
    {
      text: categoryArr.map((item) => item.title).join('-') || '--',
      beforeText: '分类：',
    },
    {
      text: formatNum(visit_count),
      beforeText: '阅读：',
    },
    {
      text: top,
      beforeText: '权重：',
    },
  ];
  data.forEach((item, idx) => {
    (item.pointer = false), (item.id = idx + 1 + '');
  });
  rMenu.selectMenu(e, data, false, '笔记信息');
}
// 显示SSH信息
export function showSSHInfo(e, obj) {
  const { title, port, host, username, top, auth_type, categoryArr } = obj;
  let data = [
    {
      text: title,
      beforeText: '标题：',
    },
    {
      text: categoryArr.map((item) => item.title).join('-') || '--',
      beforeText: '分类：',
    },
    {
      text: auth_type === 'password' ? '密码' : '密钥',
      beforeText: '认证方式：',
    },
    {
      text: username,
      beforeText: '用户名：',
    },
    {
      text: port,
      beforeText: '端口：',
    },
    {
      text: host,
      beforeText: '主机：',
    },
    {
      text: top,
      beforeText: '权重：',
    },
  ];
  data.forEach((item, idx) => {
    (item.pointer = false), (item.id = idx + 1 + '');
  });
  rMenu.selectMenu(e, data, false, 'SSH信息');
}
