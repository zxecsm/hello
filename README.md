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
      - /:/root/helloApp
    ports:
      - '55555:55555'
```

> 注意歌词格式：`[00:00.00]歌词<=>翻译`

随机壁纸

```
http://localhost:55555/api/bg/r/big    # 大屏
http://localhost:55555/api/bg/r/small  # 小屛
```

获取网站图标

```
http://localhost:55555/api/getfavicon?u=[https://]google.com
```

获取网站信息

```
http://localhost:55555/api/bmk/parse-site-info?u=[https://]google.com
```

回显接口

```
http://localhost:55555/api/echo?msg=hello
```

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
