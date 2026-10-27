# AI 素材中心（AI Asset Hub）

[![CI](https://github.com/johnricy8-create/AI-materials-center/actions/workflows/ci.yml/badge.svg)](https://github.com/johnricy8-create/AI-materials-center/actions/workflows/ci.yml)

**GitHub**：https://github.com/johnricy8-create/AI-materials-center

面向电商运营、内容创作者和企业运营的 AI 素材管理平台：上传素材 → AI 理解 → 自然语言检索 → Agent 生成文案。

## 当前状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| M0 高保真 Demo | 已完成 | React + Vite + Tailwind，6 个页面，响应式 |
| M1 FastAPI + SQLite | 已完成 | 真实上传、本地存储、素材 CRUD、缩略图、统计 |
| M2 GLM 解析 | 已完成 | GLM-4.7-Flash 文本分析 + GLM-4V-Flash 图片理解 |
| 前端联调 | 已完成 | 素材库/上传/详情/搜索读取真实后端；无后端时自动回退 Demo 数据 |
| M3 混合检索 | 已完成 | Embedding-3 + sqlite-vec + 关键词融合 |
| M4 LangGraph Agent | 已完成 | 意图识别、检索、评估、有限重试、文案生成、真实任务 trace、SSE |
| M5 测试与部署 | 已完成 | pytest / ruff / Vite build / Docker Compose 实机启动 / README |

## 项目结构

```text
AI素材中心/
├── demo/           # React 前端（已接后端，可降级为纯 Demo）
├── backend/        # FastAPI + SQLAlchemy + SQLite
├── docs/           # 设计方案、预览说明、截图
└── storage/        # 上传文件与缩略图（本地，已忽略）
```

## 启动

### 1. 后端

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API 文档：http://127.0.0.1:8000/docs

### 2. 前端

```bash
cd demo
npm install
npm run dev
```

打开：http://127.0.0.1:5173/#/

前端会请求 `http://127.0.0.1:8000/api/v1`。如果后端未启动，会自动使用内置 Demo 数据，方便单独预览。

## 配置与安全

- 模型 Key 只放在 `backend/.env`，根目录 `.gitignore` 已忽略 `.env`、`storage/`、数据库文件；
- 前端只通过后端接口访问模型能力，不会接触 Key；
- 文本模型：`glm-4.7-flash`，429 时自动回退 `glm-4-flash-250414`；
- 图片理解：`glm-4v-flash`；
- Embedding：`embedding-3`，1024 维（M3 接入）；
- 当前数据库：SQLite（临时方案），后续迁移 PostgreSQL + pgvector。

## 已实现接口

```text
GET    /api/v1/health
GET    /api/v1/config/public
GET    /api/v1/stats
GET    /api/v1/facets
POST   /api/v1/assets                 多文件上传
GET    /api/v1/assets                 列表 / 筛选 / 分页
GET    /api/v1/assets/{id}            详情 + 分块
PATCH  /api/v1/assets/{id}            修改名称 / 分类 / 标签
DELETE /api/v1/assets/{id}            删除
POST   /api/v1/assets/{id}/reanalyze  重新 AI 解析
GET    /api/v1/assets/{id}/file       原文件
GET    /api/v1/assets/{id}/thumbnail  缩略图
POST   /api/v1/search                 混合检索
POST   /api/v1/agent/tasks            创建 Agent 任务
GET    /api/v1/agent/tasks            任务列表
GET    /api/v1/agent/tasks/{id}       任务详情 + 节点 trace
GET    /api/v1/agent/tasks/{id}/events  SSE 事件
POST   /api/v1/agent/tasks/{id}/retry 重试
POST   /api/v1/agent/tasks/{id}/cancel 取消
```

## Agent 工作流

LangGraph 状态图：

```text
理解需求
  → 路由
  → 混合检索
  → 结果评估
      ├─ 结果不足 → 改写查询 → 混合检索（最多 1 次）
      ├─ 文案生成 → 3 个版本文案 → 整理
      └─ 素材分析 / 搜索 → 整理
  → 保存任务与节点 trace
```

任务节点、耗时、输入输出摘要写入 `agent_task_steps`；前端工作台和任务中心读取真实任务，
SSE 接口可用于实时消费节点事件。

## 测试

```bash
cd backend
uv run pytest
uv run ruff check app tests
```

```bash
cd demo
npm run build
```

## Docker Compose

```bash
# 先准备 backend/.env（至少包含 GLM_API_KEY）
docker compose up -d --build
```

访问：

- 前端（Docker Nginx）：http://127.0.0.1:8080
- 本机 Nginx 网关：http://127.0.0.1:8081
- API：http://127.0.0.1:8000/docs

本机 Nginx 安装与反向代理说明见 `docs/Nginx安装与验证.md`。

当前开发机已安装 Docker Desktop 到 `D:\docker`，并完成 Compose 实机启动验证。
详细安装记录见 `docs/Docker安装与验证.md`。

也可以直接使用已推送的镜像：

- `heinrich8/ai-asset-hub-backend:latest`
- `heinrich8/ai-asset-hub-frontend:latest`
- 版本标签：`v0.1.0`

```bash
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

> 当前网络下 `auth.docker.io` 不可直连，基础镜像需通过
> `docker.m.daocloud.io` 等镜像站拉取；保持 Clash Verge 开启。
> 拉取 Docker Hub 上的项目镜像如果超时，也可以给对应镜像配置代理/镜像站。

## 后续可选增强

1. 检索评估集与重排（BGE reranker）；
2. OCR、视频关键帧、图片去重；
3. 多用户权限、收藏、审计；
4. 定时批处理、成本统计与模型监控。
