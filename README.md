# bit-labs（Owl 单体加载器）

独立 Go 模块，作为 Owl 单体应用的**前后端组装入口**，聚合门户、内容、评论、短信、指标、Firefly 云、vlink 协调服务与 `owl-admin`。

本仓库不包含业务逻辑；Firefly 云业务代码位于 [`../firefly/cloud`](../firefly/cloud)。

## 前置条件

- Go 1.26+
- PostgreSQL、Redis（或按各子应用 Provider 配置）
- 本地 `owl`、`owl-admin`、`owl-cms`、`owl-comment`、`owl-portal`、`owl-sms`、`owl-metrics`、`firefly/cloud`、`vlink` 源码（`go.mod` 已 `replace` 到同级目录）

## 目录结构

```text
bit-labs/
  main.go              # 单体后端入口
  app/app.go           # SubAppBitLabs 空壳（占位，未在 main 中注册）
  frontend/admin/      # 管理后台前端组装入口
  conf/                # 首次启动自动生成（已 gitignore）
```

## 启动

**后端：**

```bash
cd bit-labs
go mod tidy
go run .
```

首次运行后检查并编辑 `conf/` 中的数据库、Redis、JWT、license 等配置。协调服务会生成 `conf/coordinator.yaml`，其中 `controlListen` 是节点连接的控制协议地址，默认 `0.0.0.0:34720`。默认 HTTP：`http://127.0.0.1:8080`

**前端：**

```bash
cd frontend/admin
pnpm dev    # 自动推断项目；首次会在 owl-ui/builder 生成 workspace 并 install
pnpm build  # 产物在本目录 dist/
```

配置自持于本目录：`.env` / `.env.example` / `.env.*`、`public/`、`main.ts`。无需进入 `owl-ui/builder` 改配置。

登录后先到 `/apps/index` 选择子系统，再进入该子系统的菜单。顶栏「主页」回到这一页。

## 子应用说明

| 子应用 | 模块 | 职责 |
|--------|------|------|
| portal | owl-portal | 门户站点 |
| cms | owl-cms | 内容管理 |
| comment | owl-comment | 评论 |
| sms | owl-sms | 短信 |
| firefly | firefly-cloud | 许可证、升级包等 |
| metrics | owl-metrics | 指标分析 |
| coordinator | vlink/coordinator | 虚拟网络协调服务 |
| admin | owl-admin | 平台管理、登录鉴权 |
