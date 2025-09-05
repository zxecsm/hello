import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';

import {
  queryURLParams,
  myOpen,
  imgjz,
  pageErr,
  pageScrollTop,
  getTextImg,
  formatDate,
  enterPassCode,
  userLogoMenu,
  LazyLoad,
  getScreenSize,
  hdOnce,
  isIframe,
} from '../../js/utils/utils';

import defaultIcon from '../../images/img/default-icon.png';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import { reqBmkGetShare, reqBmkSaveShare } from '../../api/bmk';
import pagination from '../../js/plugins/pagination';
import _d from '../../js/common/config';
import toolTip from '../../js/plugins/tooltip/index';
import rMenu from '../../js/plugins/rightMenu';
import { showBmkInfo } from '../../js/utils/showinfo';
import { _tpl } from '../../js/utils/template';
import _path from '../../js/utils/path';
import cacheFile from '../../js/utils/cacheFile';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg, waitLogin } from '../home/home';
import localData from '../../js/common/localData';

const urlparmes = queryURLParams(myOpen()),
  shareId = urlparmes.s;
if (!shareId) {
  pageErr();
}

let pageNo = 1;
let bmList = [];
let bmPageSize = 12;
let passCode = localData.session.get('passCode', shareId) || '';
let shareToken = '';

const bmLoadImg = new LazyLoad();
const $box = $('.box');
const $head = $('.head');
const $paginationBox = $('.pagination_box');
if (!isIframe()) {
  waitLogin(() => {
    // 同步数据
    realtime.init().add((res) => {
      res.forEach((item) => {
        otherWindowMsg(item);
      });
    });
  });
}
// 生成列表
function renderList() {
  const pageTotal = Math.ceil(bmList.length / bmPageSize);
  pageNo < 1 ? (pageNo = pageTotal) : pageNo > pageTotal ? (pageNo = 1) : null;

  const html = _tpl(
    `
    <div v-for="{title,des,id} in list" :data-id="id" cursor="y" class="bm_item no_select">
      <div class="logo"></div>
      <div class="bm_title">{{title}}</div>
      <p>{{des || '描述'}}</p>
    </div>
    `,
    {
      list: bmList.slice((pageNo - 1) * bmPageSize, pageNo * bmPageSize),
    }
  );

  pgnt.render({
    pageSize: bmPageSize,
    total: bmList.length,
    pageNo,
    small: getScreenSize().w <= _d.screen,
  });

  $box.html(html).addClass('open');
  $head.addClass('open');
  $paginationBox.addClass('open');

  const bmItems = [...$box[0].querySelectorAll('.bm_item')].filter((item) => {
    const $item = $(item),
      { link } = getBmInfo($item.attr('data-id')),
      url = `/api/getfavicon?u=${encodeURIComponent(link)}`;

    const cache = cacheFile.hasUrl(url, 'image');
    if (cache) {
      const $img = $item.find('.logo');
      $img
        .css({
          'background-image': `url(${cache})`,
        })
        .addClass('load');
    }
    return !cache;
  });
  bmLoadImg.bind(bmItems, (item) => {
    const $item = $(item),
      { link } = getBmInfo($item.attr('data-id')),
      url = `/api/getfavicon?u=${encodeURIComponent(link)}`;

    const $img = $item.find('.logo');
    imgjz(url)
      .then((cache) => {
        $img
          .css({
            'background-image': `url(${cache})`,
          })
          .addClass('load');
      })
      .catch(() => {
        $img
          .css({
            'background-image': `url(${defaultIcon})`,
          })
          .addClass('load');
      });
  });

  pageScrollTop(0);
}

// 分页
const pgnt = pagination($paginationBox[0], {
  select: [12, 24, 36, 48],
  change(val) {
    pageNo = val;
    renderList();
  },
  changeSize(val) {
    bmPageSize = val;
    pageNo = 1;
    renderList();
  },
  toTop() {
    pageScrollTop(0);
  },
});

let defaultTitle = '';

function getBmInfo(id) {
  return bmList.find((item) => item.id === id) || {};
}

const verifyCode = hdOnce(() => {
  enterPassCode(({ close, val, loading }) => {
    passCode = val;
    getShareData(close, loading);
  });
});

// 获取书签数据
function getShareData(close, loading = { start() {}, end() {} }) {
  loading.start();
  reqBmkGetShare({ id: shareId, pass: passCode })
    .then((res) => {
      loading.end();
      if (res.code === 1) {
        localData.session.set('passCode', passCode, shareId);
        close && close();

        const { username, logo, account, data, title, exp_time, email, token } =
          res.data;
        shareToken = token;
        $head._uObj = { username, account, email };
        defaultTitle = title;
        if (logo) {
          imgjz(_path.normalize('/api/pub/logo', account, logo))
            .then((cache) => {
              $head.find('.logo').css('background-image', `url(${cache})`);
            })
            .catch(() => {
              $head
                .find('.logo')
                .css('background-image', `url(${getTextImg(username)})`);
            });
        } else {
          $head
            .find('.logo')
            .css('background-image', `url(${getTextImg(username)})`);
        }

        $head.find('.from').text(username);
        $head.find('.title').text(title);
        $head.find('.valid').text(
          exp_time === 0
            ? '永久'
            : formatDate({
                template: '{0}-{1}-{2} {3}:{4}',
                timestamp: exp_time,
              })
        );

        bmList = data.map((item, idx) => ({ ...item, id: idx + 1 + '' }));
        renderList();
      } else if (res.code === 3) {
        if (passCode) {
          _msg.error('提取码错误');
        }
        verifyCode();
      }
    })
    .catch(() => {
      loading.end();
    });
}

getShareData();

// 保存书签
function saveBm(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          value: defaultTitle,
          placeholder: '书签分组名称',
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLength.title) {
              return '名称过长';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      loading.start();
      reqBmkSaveShare({ title: inp.title, token: shareToken })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            _msg.success(res.codeText);
            close();
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '保存书签到分组'
  );
}

$head
  .on('click', '.logo', function (e) {
    const { account, username, email } = $head._uObj;
    userLogoMenu(e, account, username, email);
  })
  .on('click', '.save_to_list', saveBm);

$box
  .on('click', '.bm_item', function () {
    const $this = $(this),
      { link } = getBmInfo($this.attr('data-id'));
    myOpen(link, '_blank');
  })
  .on('click', '.logo', function (e) {
    e.stopPropagation();
    const $this = $(this).parent(),
      obj = getBmInfo($this.attr('data-id'));
    showBmkInfo(e, obj);
  })
  .on('mouseenter', '.bm_item .logo', function () {
    const { title, link, des } = getBmInfo($(this).parent().attr('data-id'));
    const str = `名称：${title || '--'}\n链接：${link || '--'}\n描述：${
      des || '--'
    }`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.bm_item .logo', function () {
    toolTip.hide();
  });
