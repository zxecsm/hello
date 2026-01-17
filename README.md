```
services:
  hello:
    image: 'ghcr.io/zxecsm/hello:latest'
    # image: 'zxecsm/hello:latest'
    container_name: hello
    restart: unless-stopped
    environment:
      - TZ=Asia/Shanghai
    volumes:
      - /sys/class/net:/sys/class/net:ro
      - /:/root/helloApp
    ports:
      - '55555:55555'
```

```
sudo docker run -d \
  --name hello \
  --restart unless-stopped \
  -e TZ=Asia/Shanghai \
  -v /sys/class/net:/sys/class/net:ro \
  -v /:/root/helloApp \
  -p 55555:55555 \
  ghcr.io/zxecsm/hello:latest
  # zxecsm/hello:latest
```

歌词格式：`[00:00.00]歌词<=>翻译`

随机壁纸

```
http://localhost:55555/api/bg/r/d    # 桌面端壁纸
http://localhost:55555/api/bg/r/m    # 移动端壁纸
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

添加书签窗口（用于扩展和油猴脚本添加书签）

```
http://localhost:55555/addbmk/#{{https://google.com}}
```

接收推送消息

```
GET： http://localhost:55556/api/s/<key>?text=消息内容
POST：http://localhost:55556/api/s/<key> body：{"text": "消息内容"}
```

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
