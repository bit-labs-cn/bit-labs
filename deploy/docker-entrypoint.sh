#!/bin/sh
# 启动 Go 后端，并将镜像内静态资源同步到共享卷供 Caddy 托管
set -eu

WWW_EXPORT="${WWW_EXPORT:-/export/www}"

if [ -d /app/www ]; then
  mkdir -p "$WWW_EXPORT"
  cp -a /app/www/. "$WWW_EXPORT"/
fi

exec /app/bit-labs
