import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import '../../js/common/common';
import { isLogin, myOpen, queryURLParams, toLogin } from '../../js/utils/utils';
import { reqBmkAddBmk, reqBmkList, reqBmkSiteInfo } from '../../api/bmk';
import rMenu from '../../js/plugins/rightMenu';
import _d from '../../js/common/config';
import _msg from '../../js/plugins/message';

if (!isLogin()) {
  toLogin();
}

const { HASH } = queryURLParams(myOpen());

window.addEventListener('load', async () => {
  try {
    const res = await reqBmkList();
    if (res.code === 1) {
      const { list } = res.data;
      list.unshift({ id: 'home', title: '主页' });
      rMenu.inpMenu(
        false,
        {
          subText: '添加',
          items: {
            link: {
              beforeText: '网址：',
              placeholder: 'https://',
              value: HASH,
              verify(val) {
                return rMenu.validString(val, 1, _d.fieldLength.url) || rMenu.validUrl(val);
              },
            },
          },
        },
        function ({ inp, close, loading }) {
          const u = inp.link;
          loading.start();
          reqBmkSiteInfo({ u })
            .then((result) => {
              loading.end();
              if (result.code === 1) {
                close();
                const { title, des } = result.data;
                rMenu.inpMenu(
                  false,
                  {
                    subText: '提交',
                    items: {
                      title: {
                        beforeText: '标题：',
                        value: title,
                        verify(val) {
                          return rMenu.validString(val, 1, _d.fieldLength.title);
                        },
                      },
                      groupId: {
                        beforeText: '选择分组：',
                        type: 'select',
                        value: 'home',
                        selectItem: list.map((item) => ({
                          value: item.id,
                          text: item.title,
                        })),
                      },
                      link: {
                        beforeText: '网址：',
                        placeholder: 'https://',
                        value: u,
                        verify(val) {
                          return (
                            rMenu.validString(val, 1, _d.fieldLength.url) || rMenu.validUrl(val)
                          );
                        },
                      },
                      des: {
                        beforeText: '描述：',
                        value: des,
                        type: 'textarea',
                        verify(val) {
                          return rMenu.validString(val, 0, _d.fieldLength.des);
                        },
                      },
                    },
                  },
                  function ({ close, inp, loading }) {
                    const { title, groupId, link, des } = inp;
                    loading.start();
                    reqBmkAddBmk({
                      groupId,
                      bms: [
                        {
                          title,
                          link,
                          des,
                        },
                      ],
                    })
                      .then((result) => {
                        loading.end();
                        if (result.code === 1) {
                          close(true);
                          _msg.success(result.codeText, () => {
                            window.close();
                          });
                        }
                      })
                      .catch(() => {
                        loading.end();
                      });
                  },
                  '添加书签',
                  1,
                  1,
                );
              }
            })
            .catch(() => {
              loading.end();
            });
        },
        '添加书签',
        1,
        1,
      );
    }
  } catch {}
});
