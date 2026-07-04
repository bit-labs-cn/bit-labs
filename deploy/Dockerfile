# bit-labs：前端 SPA + Go 后端单体镜像（静态由 Caddy 托管，容器内无 nginx）
#
# 在 bit-labs/deploy 目录构建（见 README.md）：
#   docker build -f Dockerfile -t bit-labs:v1.0.0 ../..

# ---------- 1) 前端 SPA 构建 ----------
FROM node:22-alpine AS frontend
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /ws

COPY owl-ui-builder ./owl-ui-builder
COPY owl-ui ./owl-ui
COPY owl-admin/frontend/admin ./owl-admin/frontend/admin
COPY owl-cms/frontend/admin ./owl-cms/frontend/admin
COPY owl-portal/frontend/admin ./owl-portal/frontend/admin
COPY owl-sms/frontend/admin ./owl-sms/frontend/admin
COPY firefly/cloud/frontend/admin ./firefly/cloud/frontend/admin
COPY bit-labs/frontend/admin ./bit-labs/frontend/admin

WORKDIR /ws/owl-ui-builder
RUN cp package.base.json package.json \
  && printf 'packages:\n  - "."\n' > pnpm-workspace.yaml \
  && pnpm install

RUN node scripts/gen-package.mjs --all \
  && pnpm install

ARG BUILD_PUBLIC_PATH=/
ENV VITE_PUBLIC_PATH=${BUILD_PUBLIC_PATH}

WORKDIR /ws/bit-labs/frontend/admin
RUN pnpm build \
  && set -eux \
  && js=$(sed -n 's|.*src="\(/static/js/[^"]*\.js\)".*|\1|p' dist/index.html | head -1) \
  && test -n "$js" \
  && test -f "dist${js}" \
  && echo "frontend bundle ok: ${js}"

# ---------- 2) Go 后端构建 ----------
FROM golang:1.26-alpine AS backend
RUN apk add --no-cache ca-certificates git
ENV GOPRIVATE=bit-labs.cn
ENV GOTOOLCHAIN=auto
ENV CGO_ENABLED=0
ENV GOOS=linux
ARG GOPROXY
ENV GOPROXY=${GOPROXY:-https://proxy.golang.org,direct}

WORKDIR /src
COPY owl ./owl
COPY owl-admin ./owl-admin
COPY owl-cms ./owl-cms
COPY owl-portal ./owl-portal
COPY owl-sms ./owl-sms
COPY firefly/cloud ./firefly/cloud

COPY bit-labs/go.mod bit-labs/go.sum ./bit-labs/
WORKDIR /src/bit-labs
RUN go mod download

COPY bit-labs/main.go ./
COPY bit-labs/app ./app
RUN go build -ldflags="-s -w" -o /out/bit-labs .

# ---------- 3) 运行期：Go 后端 + 前端静态（供 Caddy 经共享卷读取） ----------
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata wget
ENV TZ=Asia/Shanghai

WORKDIR /app

COPY --from=backend /out/bit-labs /app/bit-labs
COPY --from=frontend /ws/bit-labs/frontend/admin/dist /app/www
COPY bit-labs/deploy/docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /app/conf /app/storage /app/runtime /export/www \
  && sed -i 's/\r$//' /docker-entrypoint.sh \
  && chmod +x /docker-entrypoint.sh \
  && test -f /app/www/index.html \
  && js=$(sed -n 's|.*src="\(/static/js/[^"]*\.js\)".*|\1|p' /app/www/index.html | head -1) \
  && test -n "$js" \
  && test -f "/app/www${js}" \
  && echo "static bundle ok: ${js}"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
