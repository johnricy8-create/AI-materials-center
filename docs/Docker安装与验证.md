# Docker Desktop 安装与验证结果

## 当前状态

- Docker Desktop：`D:\docker`，版本 4.97.0
- Docker CLI：29.9.2
- Docker Compose：v5.6.1
- WSL：3.0.3.0，WSL2 正常
- `com.docker.service`：Running / Automatic
- Docker 引擎：运行中
- 项目容器：已启动

## 当前访问地址

- 前端（Docker/Nginx）：http://127.0.0.1:8080
- 后端（Docker）：http://127.0.0.1:8000
- API 文档：http://127.0.0.1:8000/docs

## 安装过程记录

1. 启用 WSL 可选组件；
2. 安装 WSL 3.0.3.0 MSI；
3. 使用 `--installation-dir=D:\docker` 安装 Docker Desktop；
4. 重启系统；
5. 启动 Docker Desktop，WSL2 引擎正常；
6. 通过 DaoCloud 镜像站预拉取基础镜像；
7. `docker compose up -d --build` 成功。

## 镜像拉取说明

`auth.docker.io` 在当前网络下会超时，因此不要关闭 Clash Verge。已通过镜像站拉取并打标准标签：

```powershell
docker pull docker.m.daocloud.io/library/python:3.12-slim
docker tag docker.m.daocloud.io/library/python:3.12-slim python:3.12-slim

docker pull docker.m.daocloud.io/library/node:22-alpine
docker tag docker.m.daocloud.io/library/node:22-alpine node:22-alpine

docker pull docker.m.daocloud.io/library/nginx:1.27-alpine
docker tag docker.m.daocloud.io/library/nginx:1.27-alpine nginx:1.27-alpine
```

后续如需拉取新镜像，建议在 Docker Desktop 的 Docker Engine 设置中增加：

```json
{
  "registry-mirrors": ["https://docker.m.daocloud.io"]
}
```

## 已推送镜像

Docker Hub（公开仓库）：

- `heinrich8/ai-asset-hub-frontend:latest`
- `heinrich8/ai-asset-hub-backend:latest`
- 版本：`v0.1.0`

只用镜像启动：

```powershell
cd D:\AI素材中心
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

仓库页面：

- https://hub.docker.com/r/heinrich8/ai-asset-hub-frontend
- https://hub.docker.com/r/heinrich8/ai-asset-hub-backend

## 项目启动

```powershell
cd D:\AI素材中心
docker compose up -d
```

查看状态：

```powershell
docker compose ps
docker compose logs -f backend
```

停止：

```powershell
docker compose down
```

## 验证结果

```text
/api/v1/health  -> status=ok
数据库          -> true
存储            -> true
模型配置        -> true
素材            -> 16 / 16 ready
前端 8080       -> HTTP 200
后端 8000       -> HTTP 200
```

## 存储位置说明

- Docker Desktop 程序：`D:\docker`
- 基础镜像和容器数据：Docker Desktop 默认放在 C 盘 WSL 虚拟磁盘
  - `C:\Users\Administrator\AppData\Local\Docker\wsl`
- Docker CLI 插件：`C:\Program Files\Docker\cli-plugins`

如需把 WSL 镜像数据也迁移到 D 盘，可在 Docker Desktop
`Settings → Resources → Advanced → Disk image location` 中修改；
这是独立操作，迁移前建议先备份。
