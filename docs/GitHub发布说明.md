# GitHub 发布说明

## 当前状态

已推送到：

```text
https://github.com/johnricy8-create/AI-materials-center
```

分支：`main`

## 发布前检查

```powershell
cd D:\AI素材中心
git status
```

必须确认以下内容**没有**被加入 Git：

- `backend/.env`（GLM API Key）
- `backend/data/`（SQLite 数据库）
- `storage/`（上传文件）
- `demo/node_modules/`
- `demo/dist/`
- `backend/.venv/`

`.gitignore` 已覆盖这些路径。

## 初始化与提交

```powershell
cd D:\AI素材中心
git init -b main
git add .
git status
git commit -m "feat: AI Asset Hub MVP with LangGraph agent and Docker deployment"
```

## 关联 GitHub 仓库

把下面的 `YOUR_NAME/YOUR_REPO` 换成实际仓库：

```powershell
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

如果仓库已有内容：

```powershell
git pull --rebase origin main
git push -u origin main
```

## 需要确认的仓库设置

- 仓库可见性：Public / Private；
- 不要提交 `backend/.env`；
- Docker Hub 镜像为公开仓库：
  - `heinrich8/ai-asset-hub-frontend:v0.1.0`
  - `heinrich8/ai-asset-hub-backend:v0.1.0`；
- README 中的运行说明已包含本地运行、Docker Compose 和 Nginx 网关。

## CI

已提供 `.github/workflows/ci.yml`：

- 后端：ruff + pytest；
- 前端：npm ci + build。

首次推送后可在 GitHub Actions 页面查看结果。

## 演示视频脚本

建议录制 1–2 分钟：

1. 打开首页，展示 16 个素材和 LIVE · SQLITE；
2. 素材库筛选、打开详情、展示 AI 摘要与标签；
3. 上传一张新图片，展示解析状态；
4. 智能搜索「阳光明媚的度假胜地」，展示混合检索和匹配理由；
5. AI 工作台发送「为耳机新品写小红书种草文案」；
6. 展示 5 个 Agent 节点、引用素材和生成文案；
7. 任务中心打开任务，展示 trace、耗时、重试；
8. 结束画面展示 README、Docker Compose 和镜像仓库。
