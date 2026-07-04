# bit-labs Docker 部署

前后端**单体镜像**（Go 后端 + 内置前端静态资源），由 **Caddy** 统一托管 SPA 并反代 API；`docker-compose` 编排 PostgreSQL 18 与 Redis。

`docker-compose` **不包含 build**，需先单独构建或加载镜像后再启动。

## 目录

```
deploy/
├── Dockerfile
├── docker-compose.yaml
├── docker-entrypoint.sh
├── caddy/Caddyfile        # 静态 SPA + API 反代
├── .env.example
└── README.md
```

## 架构

| 服务 | 镜像 | 说明 |
|------|------|------|
| `postgres` | `postgres:18` | 数据库 |
| `redis` | `redis:7-alpine` | 缓存 / 锁 |
| `server` | `bit-labs:v1.0.0`（预构建） | Go 后端（:8080）+ 静态资源同步到共享卷 |
| `caddy` | `caddy:2.9-alpine` | 对外 80/443；托管 SPA，反代 `/api` 等 |

server 启动时将镜像内 `/app/www` 同步到共享卷 `www_data`，Caddy 只读挂载该卷提供静态文件，**容器内无 nginx**。

## 构建镜像

在 **`bit-labs/deploy` 目录**执行，构建上下文为 monorepo 根目录（`../..`）：

```bash
cd bit-labs/deploy

docker build -f Dockerfile -t bit-labs:v1.0.0 ../..
```

### 常用参数

```bash
# 子路径部署
docker build -f Dockerfile \
  --build-arg BUILD_PUBLIC_PATH=/labs/ \
  -t bit-labs:v1.0.0 ../..

# 私有 Go 代理
docker build -f Dockerfile \
  --build-arg GOPROXY=https://your-goproxy \
  -t bit-labs:v1.0.0 ../..
```

### 导出 / 加载镜像

```bash
docker save bit-labs:v1.0.0 -o bit-labs.tar
docker load -i bit-labs.tar
```

## 启动

```bash
cd bit-labs/deploy
cp .env.example .env
# 编辑 .env 设置密码与镜像名

docker compose up -d
```

首次启动后，检查并编辑 `./conf/` 中的数据库、Redis、JWT 等配置（Owl 首次运行会自动生成），然后重启 server：

```bash
docker compose restart server
```

## 访问

- 站点：http://localhost（经 Caddy）
- API：http://localhost/api/v1/...
- 健康检查：http://localhost/health

## 配置与数据

| 路径 | 说明 |
|------|------|
| `./conf/` | 后端配置，挂载到 `/app/conf` |
| `./storage/` | 上传文件等运行时数据 |
| `.env` | 编排环境变量，同时挂载到容器 `/app/.env` |

`deploy/conf/database.yaml` 中 PostgreSQL 主机应填 `postgres`，Redis 主机填 `redis`。

## 日志

```bash
docker compose logs -f caddy
docker compose logs -f server
```
