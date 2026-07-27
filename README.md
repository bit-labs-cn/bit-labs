# bit-labs（Owl 单体加载器）

独立 Go 模块，作为 Owl 单体应用的**前后端组装入口**，聚合 `owl-portal`、`owl-cms`、`owl-sms`、`owl-admin` 与 `firefly-cloud` 子应用。

本仓库不包含业务逻辑；Firefly 云业务代码位于 [`../firefly/cloud`](../firefly/cloud)。

## 前置条件

- Go 1.26+
- PostgreSQL、Redis（或按各子应用 Provider 配置）
- 本地 `owl`、`owl-admin`、`owl-cms`、`owl-portal`、`owl-sms`、`firefly/cloud` 源码（`go.mod` 已 `replace` 到同级目录）

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

首次运行后检查并编辑 `conf/` 中的数据库、Redis、JWT、license 等配置。默认 HTTP：`http://127.0.0.1:8080`

**前端：**

```bash
cd frontend/admin
pnpm dev    # 自动推断项目；首次会在 owl-ui-builder 生成 workspace 并 install
pnpm build  # 产物在本目录 dist/
```

配置自持于本目录：`.env*`、`public/`、`builder.projects.yaml`、`main.ts`。无需进入 `owl-ui-builder` 改配置。

## 子应用说明

| 子应用 | 模块 | 职责 |
|--------|------|------|
| portal | owl-portal | 门户站点 |
| cms | owl-cms | 内容管理 |
| sms | owl-sms | 短信 |
| firefly | firefly-cloud | 许可证、升级包等 |
| admin | owl-admin | 平台管理、登录鉴权 |
