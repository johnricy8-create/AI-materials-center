# 本机 Nginx 安装与验证

## 当前状态

- Nginx：1.28.3
- 安装目录：`D:\nginx`
- 配置文件：`D:\nginx\conf\nginx.conf`
- 监听端口：`8081`
- 反向代理：
  - `/` → Docker 前端 `http://127.0.0.1:8080`
  - `/api/` → Docker 后端 `http://127.0.0.1:8000`
- 访问地址：**http://127.0.0.1:8081/#/**
- 配置检查：`syntax is ok` / `test is successful`

## 架构说明

当前有两层 Nginx：

```text
浏览器
  ↓
Windows 本机 Nginx :8081
  ├─ /      → Docker ai-web :8080（容器内 Nginx）
  └─ /api/  → Docker ai-backend :8000
```

本机 Nginx 是网关，不替代 Docker 内的 Nginx。

## 常用命令

在 PowerShell 中：

```powershell
cd D:\nginx

# 检查配置
.\nginx.exe -t

# 启动
Start-Process .\nginx.exe -WorkingDirectory D:\nginx

# 重载配置
.\nginx.exe -s reload

# 停止
.\nginx.exe -s stop
```

日志：

```text
D:\nginx\logs\access.log
D:\nginx\logs\error.log
```

## 验证

```powershell
Invoke-WebRequest http://127.0.0.1:8081/ -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:8081/api/v1/health
```

当前结果：

```text
frontend 8081 -> 200
api health    -> ok
```

## 注意

- 本机 Nginx 不是 Windows 服务，重启系统后需要手动执行启动命令。
- 如果 8081 被占用，修改 `conf/nginx.conf` 的 `listen`。
- Docker 容器必须先启动，否则 Nginx 会返回 502：

```powershell
cd D:\AI素材中心
docker compose up -d
```
