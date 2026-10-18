![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)

```
services:
  hello:
    image: 'ghcr.io/zxecsm/hello:latest'
    container_name: hello
    restart: unless-stopped
    environment:
      - TZ=Asia/Shanghai          # 时区
      # - UV_THREADPOOL_SIZE=12   # 文件处理并发 libuv 线程池大小，默认4
      # - COOKIE_SECURE=false     # HTTP 设为 false，否则无法登录；HTTPS 不设或设 true
    volumes:
      - /proc:/app/proc:ro        # 读取宿主机系统信息（CPU、内存、负载等）
      - /:/app/app_data           # 应用数据和文件管理目录
    ports:
      - '55555:55555'
```

歌词格式：
```
[00:00.00]歌词
[00:00.00]翻译
```

随机壁纸

```
http://localhost:55555/api/bg/r/d    # 桌面端壁纸
http://localhost:55555/api/bg/r/m    # 移动端壁纸
```

随机音乐

```
http://localhost:55555/api/music
```

获取网站图标

```
http://localhost:55555/api/icon?u=[https://]google.com
```

获取网站信息

```
http://localhost:55555/api/site-info?u=[https://]google.com
```

回显接口

```
http://localhost:55555/api/echo?msg=hello
```

IP地理位置

```
http://localhost:55555/api/ip-location?ip=223.5.5.5
```

添加书签窗口（用于扩展和油猴脚本添加书签）

```
http://localhost:55555/addbmk/#{{https://google.com}}
```

接收推送消息

```
GET： http://localhost:55555/api/s/<key>?text=消息内容
POST：http://localhost:55555/api/s/<key> body：{"text": "消息内容"}
```
