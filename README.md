```yml
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

- username：admin
- password：

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
