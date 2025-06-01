import '../../css/common/reset.css';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import './index.less';
import $ from 'jquery';
import '../../js/common/common';
import {
  formatBytes,
  pageScrollTop,
  getScreenSize,
  getWordCount,
  hdTitleHighlight,
  isIframe,
  isLogin,
  isRoot,
  loadingImg,
  myOpen,
  pageErr,
  toLogin,
  wrapInput,
} from '../../js/utils/utils';
import _msg from '../../js/plugins/message';
import pagination from '../../js/plugins/pagination/index';
import _d from '../../js/common/config';
import { reqRootDeleteLog, reqRootLog, reqRootLogList } from '../../api/root';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg } from '../home/home';
let curName = null;
const $head = $('.header'),
  $main = $('.main'),
  $stat = $('.stat'),
  $foot = $('.footer');
$main.pageNo = 1;
$main.list = [];
let lPageSize = 20,
  sPageSize = 50;
window.addEventListener('load', () => {
  $head.addClass('open');
});
// 搜索
const wInput = wrapInput($head.find('.inp_box input')[0], {
  update(val) {
    if (val === '') {
      $head.find('.inp_box .clean_btn').css('display', 'none');
    } else {
      $head.find('.inp_box .clean_btn').css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
  },
  blur(e) {
    $(e.target).parent().removeClass('focus');
  },
  keyup(e) {
    if (e.key === 'Enter') {
      $main.pageNo = 1;
      hdRender();
    }
  },
});
(() => {
  if (isLogin()) {
    if (!isRoot()) {
      pageErr();
    } else {
      if (!isIframe()) {
        realtime.init().add((res) => {
          res.forEach((item) => {
            otherWindowMsg(item);
          });
        });
      }
    }
  } else {
    toLogin();
  }
})();
if (isIframe()) {
  $head.find('.h_go_home').remove();
}
// 日志列表
function getLogList(e) {
  reqRootLogList()
    .then((res) => {
      if (res.code === 1) {
        const data = [];
        res.data.forEach((item, idx) => {
          const { name, size } = item;
          data.push({
            id: idx + 1 + '',
            text: `${name} - ${formatBytes(size)}`,
            param: { name },
            beforeIcon: 'iconfont icon-rizhi',
          });
        });
        rMenu.selectMenu(
          e,
          data,
          ({ close, id, param }) => {
            if (id) {
              const name = param.name;
              close();
              getLogData(name);
            }
          },
          '日志列表'
        );
      }
    })
    .catch(() => {});
}
function getLogData(name) {
  loadingImg($main[0]);
  if (curName !== name) {
    wInput.setValue('');
  }
  reqRootLog({ name })
    .then((res) => {
      if (res.code === 1) {
        $main.list = res.data;
        $main.pageNo = 1;
        curName = name;
        hdRender();
        $stat.pageNo = 1;
        $stat.list = getStatData(res.data);
        $stat.html('');
        renderStat();
        $head.find('.del_btn').css('display', 'block');
        $head.find('.refresh_btn').css('display', 'block');
        $head.find('.log_info').css('display', 'block').text(name);
      }
    })
    .catch(() => {});
}
$head
  .on('click', '.del_btn', function (e) {
    if (curName) {
      dellog(e, curName);
    }
  })
  .on('click', '.refresh_btn', function () {
    if (curName) {
      getLogData(curName);
    }
  })
  .on('click', '.clean_log', function (e) {
    dellog(e, 'all');
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.select_btn', getLogList)
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    $main.pageNo = 1;
    hdRender();
  })
  .on('click', '.inp_box .search_btn', function () {
    $main.pageNo = 1;
    hdRender();
  });
$stat.list = [];
$stat.pageNo = 1;
// 访问统计
function getStatData(list) {
  const reg = /\[([^\[\]]+)\]\(([0-9A-Fa-f.:]+)\)/,
    ipObj = {};
  list.forEach((item) => {
    const ip = item.match(reg);
    if (ip) {
      const key = 'h' + ip[2],
        addr = ip[1];
      if (ipObj.hasOwnProperty(key)) {
        ipObj[key]['total']++;
      } else {
        ipObj[key] = {
          total: 1,
          addr: addr,
        };
      }
    }
  });
  const ipArr = [];
  Object.keys(ipObj).forEach((item) => {
    ipArr.push({
      ip: item.slice(1),
      total: ipObj[item]['total'],
      addr: ipObj[item]['addr'],
    });
  });
  ipArr.sort((a, b) => b.total - a.total);
  return ipArr;
}
const spgnt = pagination($stat[0], {
  change(val) {
    $stat.pageNo = val;
    renderStat();
    _msg.botMsg(`第 ${$stat.pageNo} 页`);
  },
  changeSize(val) {
    sPageSize = val;
    $stat.pageNo = 1;
    renderStat();
    _msg.botMsg(`第 ${$stat.pageNo} 页`);
  },
  toTop() {
    $stat.scrollTop(0);
  },
});
function renderStat() {
  const pageTotal = Math.ceil($stat.list.length / sPageSize);
  $stat.pageNo < 1
    ? ($stat.pageNo = pageTotal)
    : $stat.pageNo > pageTotal
    ? ($stat.pageNo = 1)
    : null;
  const html = _tpl(
    `
    <template v-if="arr.length > 0">
      <p v-for="{ip, total, addr} in list">
        <span cursor="y" class='ip'>{{ip}}</span>({{addr}})<span>：{{total}}</span>
      </p>
      <div v-html="getPaging()"></div>
    </template>
    `,
    {
      arr: $stat.list,
      list: $stat.list.slice(
        ($stat.pageNo - 1) * sPageSize,
        $stat.pageNo * sPageSize
      ),
      getPaging() {
        return spgnt.getHTML({
          pageNo: $stat.pageNo,
          pageSize: sPageSize,
          total: $stat.list.length,
          small: getScreenSize().w <= _d.screen,
        });
      },
    }
  );
  $stat.html(html);
  $stat.scrollTop(0);
}
$stat.on('click', '.ip', function () {
  wInput.setValue(this.innerText);
  $main.pageNo = 1;
  hdRender();
});
// 分页
const pgnt = pagination($foot[0], {
  change(val) {
    $main.pageNo = val;
    hdRender();
    _msg.botMsg(`第 ${$main.pageNo} 页`);
  },
  changeSize(val) {
    lPageSize = val;
    $main.pageNo = 1;
    hdRender();
    _msg.botMsg(`第 ${$main.pageNo} 页`);
  },
  toTop() {
    pageScrollTop(0);
  },
});
// 生成日志列表
async function hdRender() {
  const word = wInput.getValue().trim();
  let arr = $main.list;
  if (word) {
    arr = $main.list.filter((item) => getWordCount([word], item) > 0);
  }
  const pageTotal = Math.ceil(arr.length / lPageSize);
  $main.pageNo < 1
    ? ($main.pageNo = pageTotal)
    : $main.pageNo > pageTotal
    ? ($main.pageNo = 1)
    : null;
  const html = _tpl(
    `
      <p v-if="arr.length === 0" style='text-align: center;'>{{_d.emptyList}}</p>
      <template v-else>
        <p v-for="data in list" v-html="hdTitleHighlight([word], data)"></p>
      </template>
      `,
    {
      word,
      _d,
      arr,
      list: arr.slice(($main.pageNo - 1) * lPageSize, $main.pageNo * lPageSize),
      hdTitleHighlight,
    }
  );
  pgnt.render({
    pageNo: $main.pageNo,
    pageSize: lPageSize,
    total: arr.length,
    small: getScreenSize().w <= _d.screen,
  });
  $main.html(html);
  pageScrollTop(0);
}
// 生成日志
function dellog(e, name) {
  rMenu.pop(
    {
      e,
      text: `确认${name === 'all' ? '清空：所有日志文件' : `删除：${name}`}？`,
      confirm: { type: 'danger', text: name === 'all' ? '清空' : '删除' },
    },
    (type) => {
      if (type === 'confirm') {
        reqRootDeleteLog({ name })
          .then((res) => {
            if (res.code === 1) {
              _msg.success('删除成功');
              $main.list = [];
              curName = null;
              $main.html('');
              $foot.html('');
              $stat.list = [];
              $stat.html('');
              $head.find('.del_btn').css('display', 'none');
              $head.find('.refresh_btn').css('display', 'none');
              $head.find('.log_info').css('display', 'none').text('');
            }
          })
          .catch(() => {});
      }
    }
  );
}
