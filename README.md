```bash
docker run -d --restart=always -p 55555:55555 -v $HOME/hello:$HOME/hello -v /:$HOME -v /etc/timezone:/etc/timezone:ro -v /etc/localtime:/etc/localtime:ro --name hello zxecsm/hello:latest
```

```yml
services:
  hello:
    image: 'zxecsm/hello:latest'
    container_name: hello
    restart: always
    volumes:
      - /:$HOME # 文件管理根目录
      - $HOME/hello:$HOME/hello # 网站数据存放目录
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - '55555:55555'
```

- username：admin
- password：

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
