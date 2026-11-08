# API 路由总表（源码自动提取）

> 由 `server/routes/*/index.js` 中的 `route.<method>(...)` 与 `server/app.js` 汇总，共 246 条。
> 所有以 `/api` 开头的路径都需要拼上实例地址，例如 `http://localhost:55555/api/bmk/list`。

## app.js 中的顶层接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/site-info?u=` | 获取网站信息（公开开关） |
| `GET` | `/api/music` | 随机音乐（公开开关） |
| `GET` | `/api/f/<path>` | 按路径读取用户文件/下载 |
| `ALL` | `/api/s/:chat_id` | 收信接口（GET ?text= / POST {text}） |

## user（40）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/user/error` | 记录错误 |
| `GET` | `/api/user/custom-code` | 获取自定义code |
| `POST` | `/api/user/register` | 注册 |
| `POST` | `/api/user/allow-login-req` | 批准登录请求 |
| `POST` | `/api/user/code-login` | 免密登录 |
| `GET` | `/api/user/captcha` |  |
| `POST` | `/api/user/captcha` | 验证验证码 |
| `POST` | `/api/user/login` |  |
| `POST` | `/api/user/verify-login` |  |
| `GET` | `/api/user/mail-code` | 发送邮件验证码 |
| `POST` | `/api/user/reset-pass` |  |
| `GET` | `/api/user/file-token` | 未登录用户访问指定文件的临时权限 |
| `GET` | `/api/user/font-list` | 获取字体列表 |
| `POST` | `/api/user/bind-mail-code` | 发送邮件验证码 |
| `POST` | `/api/user/bind-email` | 绑定邮箱 |
| `GET` | `/api/user/verify` | 获取临时两部验证token |
| `POST` | `/api/user/verify` | 设置两部验证 |
| `GET` | `/api/user/tips` | tips标识 |
| `POST` | `/api/user/allow-code-login` | 批准登录 |
| `POST` | `/api/user/change-pd` | 修改密码 |
| `POST` | `/api/user/create-token` | 生成认证token（指定有效天数） |
| `POST` | `/api/user/logout` | 退出登录 |
| `POST` | `/api/user/changename` | 修改用户名 |
| `POST` | `/api/user/delete-account` | 账号状态 |
| `GET` | `/api/user/userinfo` | 用户信息 |
| `POST` | `/api/user/delete-logo` | 删除头像 |
| `POST` | `/api/user/up-logo` | 上传logo |
| `POST` | `/api/user/daily-change-bg` | 每日更换壁纸 |
| `POST` | `/api/user/hide-state` | 隐身状态 |
| `POST` | `/api/user/remote-login-state` | 免密登录状态 |
| `GET` | `/api/user/real-time` | 获取推送消息 |
| `POST` | `/api/user/real-time` | 接收指令 |
| `POST` | `/api/user/delete-share` | 删除分享 |
| `POST` | `/api/user/share-state` | 修改分享状态 |
| `GET` | `/api/user/share-list` | 获取分享列表 |
| `POST` | `/api/user/edit-share` | 编辑分享 |
| `GET` | `/api/user/trash-list` | 回收站列表 |
| `POST` | `/api/user/delete-trash` | 删除回收站 |
| `POST` | `/api/user/recover-trash` | 恢复回收站内容 |
| `GET` | `/api/user/online-clients` | 获取在线的客户端 |

## bmk（18）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/bmk/get-share` | 分享 |
| `POST` | `/api/bmk/search` | 搜索书签 |
| `GET` | `/api/bmk/list` | 获取列表 |
| `POST` | `/api/bmk/move-group` | 分组移动 |
| `POST` | `/api/bmk/move-bmk` | 书签移动 |
| `POST` | `/api/bmk/add-group` | 新建分组 |
| `POST` | `/api/bmk/delete-group` | 删除分组 |
| `POST` | `/api/bmk/group-share-state` | 分组状态 |
| `POST` | `/api/bmk/delete-logo` | 删除自定义书签logo |
| `POST` | `/api/bmk/edit-group` | 编辑分组 |
| `POST` | `/api/bmk/add-bmk` | 添加书签 |
| `POST` | `/api/bmk/edit-bmk` | 编辑书签 |
| `POST` | `/api/bmk/bmk-to-group` | 书签移动到分组 |
| `POST` | `/api/bmk/delete-bmk` | 删除书签 |
| `POST` | `/api/bmk/share` | 分享分组 |
| `POST` | `/api/bmk/save-share` | 保存分享 |
| `POST` | `/api/bmk/import` | 导入 |
| `GET` | `/api/bmk/export` | 导出 |

## note（15）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/note/read` | 读取笔记 |
| `POST` | `/api/note/search` | 搜索笔记 |
| `GET` | `/api/note/category` | 获取分类 |
| `POST` | `/api/note/history-state` | 笔记历史状态 |
| `GET` | `/api/note/history-state` |  |
| `POST` | `/api/note/state` | 笔记状态 |
| `POST` | `/api/note/delete` | 删除笔记 |
| `POST` | `/api/note/up-note` | 上传笔记 |
| `POST` | `/api/note/edit` | 编辑笔记 |
| `POST` | `/api/note/edit-info` | 编辑笔记信息 |
| `POST` | `/api/note/top` | 置顶权重 |
| `POST` | `/api/note/set-category` | 编辑笔记分类 |
| `POST` | `/api/note/edit-category` | 编辑分类 |
| `POST` | `/api/note/add-category` | 添加分类 |
| `POST` | `/api/note/delete-category` | 删除分类 |

## todo（5）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/todo/list` | 待办列表 |
| `POST` | `/api/todo/add` | 增加待办 |
| `POST` | `/api/todo/delete` | 删除待办 |
| `POST` | `/api/todo/state` | 待办状态 |
| `POST` | `/api/todo/edit` | 编辑待办 |

## count（6）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/count/list` | 倒计时列表 |
| `POST` | `/api/count/add` | 增加 |
| `POST` | `/api/count/delete` | 删除 |
| `POST` | `/api/count/edit` | 编辑 |
| `POST` | `/api/count/top` | 置顶权重 |
| `POST` | `/api/count/state` | 状态 |

## bg（8）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/bg/r/:type` | 获取随机一张壁纸 |
| `GET` | `/api/bg/random` | 随机壁纸 |
| `POST` | `/api/bg/change` | 更换壁纸 |
| `POST` | `/api/bg/collect` | 收藏壁纸 |
| `GET` | `/api/bg/list` | 壁纸列表 |
| `POST` | `/api/bg/delete` | 删除壁纸 |
| `POST` | `/api/bg/up` | 上传 |
| `POST` | `/api/bg/repeat` | 重复 |

## pic（4）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/pic/up` | 上传图片 |
| `POST` | `/api/pic/repeat` | 重复图片 |
| `GET` | `/api/pic/list` | 图片列表 |
| `POST` | `/api/pic/delete` | 删除图片 |

## player（29）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/player/lrc` | 获取歌词 |
| `POST` | `/api/player/song-info` | 歌曲信息 |
| `POST` | `/api/player/get-share` | 分享 |
| `GET` | `/api/player/search` | 搜索 |
| `GET` | `/api/player/list` | 获取列表 |
| `GET` | `/api/player/export` | 导出歌单 |
| `POST` | `/api/player/import` | 导入歌单 |
| `POST` | `/api/player/last-play` | 最后播放 |
| `GET` | `/api/player/last-play` | 最后播放记录 |
| `GET` | `/api/player/random-list` | 随机播放列表 |
| `POST` | `/api/player/playlist` | 播放列表 |
| `GET` | `/api/player/playlist` | 播放列表 |
| `POST` | `/api/player/move-list` | 歌单位置 |
| `POST` | `/api/player/delete-list` | 删除歌单 |
| `POST` | `/api/player/edit-list` | 歌单编辑 |
| `POST` | `/api/player/edit-song` | 编辑歌曲 |
| `POST` | `/api/player/add-list` | 添加歌单 |
| `POST` | `/api/player/move-song` | 移动歌曲 |
| `POST` | `/api/player/collect-song` | 收藏歌曲 |
| `POST` | `/api/player/close-collect-song` | 移除收藏 |
| `POST` | `/api/player/delete-song` | 删除 |
| `POST` | `/api/player/song-to-list` | 音乐移动到歌单 |
| `POST` | `/api/player/delete-mv` | 删除mv |
| `GET` | `/api/player/read-lrc` | 读取歌词 |
| `POST` | `/api/player/edit-lrc` | 编辑歌词 |
| `POST` | `/api/player/share` | 分享 |
| `POST` | `/api/player/up` | 歌曲上传 |
| `POST` | `/api/player/repeat` | 歌曲重复 |
| `POST` | `/api/player/save-share` | 保存分享 |

## search（17）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/search/config` | 配置 |
| `POST` | `/api/search/add-engine` | 添加搜索引擎 |
| `POST` | `/api/search/edit-engine` | 编辑搜索引擎 |
| `POST` | `/api/search/delete-engine` | 删除搜索引擎 |
| `POST` | `/api/search/change-engine` | 切换搜索引擎 |
| `POST` | `/api/search/change-search-word` | 切换搜索提示词 |
| `POST` | `/api/search/delete-engine-logo` | 清除搜索引擎LOGO |
| `POST` | `/api/search/add-translator` | 添加翻译接口 |
| `POST` | `/api/search/edit-translator` | 编辑翻译接口 |
| `POST` | `/api/search/delete-translator` | 删除翻译接口 |
| `POST` | `/api/search/change-translator` | 切换翻译接口 |
| `POST` | `/api/search/delete-translator-logo` | 清除翻译接口LOGO |
| `GET` | `/api/search/split-word` | 分词 |
| `GET` | `/api/search/history-list` | 搜索历史 |
| `POST` | `/api/search/save` | 保存搜索历史 |
| `GET` | `/api/search/list` | 搜索 历史、笔记、书签 |
| `POST` | `/api/search/delete` | 删除历史记录 |

## file（31）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/file/get-share` | 分享文件 |
| `POST` | `/api/file/read-dir` |  |
| `POST` | `/api/file/read-file` | 读取文件 |
| `POST` | `/api/file/history-state` | 文件编辑历史记录 |
| `GET` | `/api/file/history-state` |  |
| `GET` | `/api/file/cd-history` | 获取访问路径历史 |
| `GET` | `/api/file/favorites` | 获取收藏目录 |
| `POST` | `/api/file/favorites` | 收藏目录 |
| `GET` | `/api/file/read-dir-size` | 读取目录大小 |
| `POST` | `/api/file/create-file` | 新建文件 |
| `POST` | `/api/file/create-link` | 创建符号链接 |
| `POST` | `/api/file/share` | 分享 |
| `POST` | `/api/file/save-file` | 保存文件 |
| `POST` | `/api/file/copy` | 复制 |
| `POST` | `/api/file/same-name` | 是否存在同名文件 |
| `POST` | `/api/file/move` | 移动 |
| `POST` | `/api/file/zip` | 压缩 |
| `POST` | `/api/file/unzip` | 解压缩 |
| `POST` | `/api/file/delete` | 删除 |
| `POST` | `/api/file/clear-trash` | 清空回收站 |
| `POST` | `/api/file/create-dir` | 新建目录 |
| `POST` | `/api/file/rename` | 重命名 |
| `POST` | `/api/file/mode` | 文件权限 |
| `POST` | `/api/file/chown` | 文件用户组 |
| `POST` | `/api/file/up` | 上传 |
| `POST` | `/api/file/merge` | 合并文件 |
| `POST` | `/api/file/breakpoint` | 断点续传 |
| `POST` | `/api/file/repeat` | 重复 |
| `POST` | `/api/file/complete` | 补全路径 |
| `POST` | `/api/file/download` | 离线下载 |
| `POST` | `/api/file/add-file-to` | 添加到播放器和壁纸 |

## chat（17）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/chat/dnd-mode` | 勿扰 |
| `POST` | `/api/chat/setdes` | 设置备注 |
| `GET` | `/api/chat/getdes` | 获取备注 |
| `GET` | `/api/chat/read-msg` | 读取消息 |
| `GET` | `/api/chat/expired` | 文件过期 |
| `POST` | `/api/chat/send-msg` |  |
| `POST` | `/api/chat/forward` | 转发消息 |
| `GET` | `/api/chat/news` | 未读消息 |
| `POST` | `/api/chat/delete-msg` | 删除消息 |
| `POST` | `/api/chat/shake-msg` | 抖一下 |
| `GET` | `/api/chat/user-list` | 成员 |
| `POST` | `/api/chat/up` | 接收文件 |
| `POST` | `/api/chat/up-voice` | 接收语音 |
| `POST` | `/api/chat/merge` | 合并文件 |
| `POST` | `/api/chat/breakpoint` | 断点续传 |
| `POST` | `/api/chat/repeat` | 检查上传文件是否重复 |
| `POST` | `/api/chat/forward-msg-link` | 配置自定义转发地址接口 |

## ssh（27）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/ssh/search` | 搜索ssh |
| `GET` | `/api/ssh/category` | 获取分类 |
| `POST` | `/api/ssh/delete` | 删除 |
| `POST` | `/api/ssh/add` | 添加ssh |
| `POST` | `/api/ssh/edit` | 编辑ssh |
| `GET` | `/api/ssh/info` | 获取ssh配置 |
| `POST` | `/api/ssh/top` | 置顶权重 |
| `POST` | `/api/ssh/set-category` | 编辑分类 |
| `POST` | `/api/ssh/edit-category` | 编辑分类 |
| `POST` | `/api/ssh/add-category` | 添加分类 |
| `POST` | `/api/ssh/delete-category` | 删除分类 |
| `POST` | `/api/ssh/connect` | 连接ssh |
| `GET` | `/api/ssh/quick-list` | 获取快捷命令 |
| `POST` | `/api/ssh/add-quick` | 添加快捷命令 |
| `POST` | `/api/ssh/edit-quick` | 编辑快捷命令 |
| `POST` | `/api/ssh/delete-quick` | 删除快捷命令 |
| `POST` | `/api/ssh/move-quick` | 移动快捷命令位置 |
| `POST` | `/api/ssh/move-to-group` | 移动快捷命令到分组 |
| `POST` | `/api/ssh/add-quick-group` | 添加快捷命令分组 |
| `POST` | `/api/ssh/edit-quick-group` | 编辑快捷命令分组 |
| `POST` | `/api/ssh/move-quick-group` | 移动快捷命令分组位置 |
| `POST` | `/api/ssh/delete-quick-group` | 删除快捷命令分组 |
| `GET` | `/api/ssh/sftp-list` | 获取sftp列表 |
| `POST` | `/api/ssh/sftp-up` | 上传sftp |
| `GET` | `/api/ssh/sftp-down` | 下载sftp |
| `GET` | `/api/ssh/history-commands` | 获取历史命令 |
| `POST` | `/api/ssh/history-commands` | 保存历史命令 |

## task（3）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/task/info` | 获取任务信息 |
| `POST` | `/api/task/cancel` | 取消任务 |
| `POST` | `/api/task/list` | 获取任务列表 |

## echo（1）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `ALL` | `/api/echo` |  |

## getfavicon（1）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/getfavicon` |  |

## root（24）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/root/email` | 配置邮箱 |
| `GET` | `/api/root/user-list` | 获取用户列表 |
| `POST` | `/api/root/favicon-spare-api` | 备用图标api |
| `POST` | `/api/root/account-state` | 账号状态 |
| `POST` | `/api/root/delete-account` | 刪除账号 |
| `POST` | `/api/root/clean-music-file` | 清理歌曲文件 |
| `POST` | `/api/root/clean-bg-file` | 清理壁纸文件 |
| `POST` | `/api/root/clean-pic-file` | 清理图床文件 |
| `POST` | `/api/root/clean-chat-file` | 清理聊天文件 |
| `POST` | `/api/root/register-state` | 设置注册状态 |
| `POST` | `/api/root/update-tokenkey` | 更新tokenKey |
| `GET` | `/api/root/log` | 读取日志 |
| `GET` | `/api/root/log-list` | 日志文件列表 |
| `POST` | `/api/root/delete-log` | 删除日志 |
| `POST` | `/api/root/trash-state` | 回收站状态 |
| `POST` | `/api/root/pub-api-state` | 公开api状态 |
| `POST` | `/api/root/change-cache-time` | 文件缓存时间 |
| `POST` | `/api/root/clean-database` | 清理数据库 |
| `POST` | `/api/root/custom-code` | 自定义代码 |
| `POST` | `/api/root/tips` | tipsFlag |
| `POST` | `/api/root/test-email` | 测试邮箱 |
| `POST` | `/api/root/test-tfa` | 测试两步验证 |
| `POST` | `/api/root/create-account` | 创建帐号 |
| `GET` | `/api/root/sys-status` | 系统状态 |
