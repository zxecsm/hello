```
services:
  hello:
    image: 'zxecsm/hello:latest'
    container_name: hello
    restart: unless-stopped
    volumes:
      - /:/root/helloFiles # 管理员文件管理根目录
      - $HOME/hello:/root/helloData # 应用数据存放目录
      - /etc/timezone:/etc/timezone:ro # 时区同步
      - /etc/localtime:/etc/localtime:ro
    ports:
      - '55555:55555'
```

- username：`admin`
- password：

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

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
