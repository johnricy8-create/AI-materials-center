# AI Asset Hub · Backend (M1)

FastAPI + SQLite 后端，提供素材上传、存储、列表、详情、删除、重新解析、关键词检索和统计接口。

## 启动

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

打开：

- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/v1/health

## 当前能力

- 多文件上传：图片 / PDF / DOCX / TXT / Markdown；
- SHA-256 去重；
- 本地文件存储 + 图片/PDF 缩略图；
- 基础解析：PDF 文本、DOCX 段落表格、TXT/MD 解码、图片尺寸；
- AI 文本分析：GLM-4.7-Flash 生成摘要、分类、标签、关键词、适用场景；
- AI 视觉理解：GLM-4V-Flash 分析图片内容；
- 主模型 429 / 解析失败时自动回退 `glm-4-flash-250414`，再失败回退本地基础分析；
- 素材列表、筛选、搜索、详情、修改、删除、重新解析；
- 混合检索：Embedding-3 + sqlite-vec + 关键词召回；
- LangGraph Agent：意图识别、检索、评估、改写重试、文案生成；
- Agent 任务、节点 trace、SSE 事件、失败重试；
- SQLite 数据库，启动自动建表；
- 进度状态：`processing → ready / failed`；
- 服务重启后把超时的 processing 素材标记为 failed。

> 搜索已升级为混合检索：Embedding-3 语义召回 + jieba 关键词召回。
> 向量写入 sqlite-vec 虚拟表 `asset_vectors`；同时保留 `asset_chunks.embedding_json`
> 作为调试与降级备份。sqlite-vec 不可用时自动回退 Python 余弦相似度。

## 说明

M2 已接入智谱：图片走 `glm-4v-flash`，文本走 `glm-4.7-flash`。免费模型高峰期可能返回 429，
服务会自动重试并回退到 `glm-4-flash-250414`；都失败时仍保留基础元数据，素材不会卡住。

向量维护脚本：

```bash
# 给旧素材补 embedding
uv run python -m scripts.backfill_embeddings

# 根据 asset_chunks 重建 sqlite-vec 索引
uv run python -m scripts.rebuild_vector_index
```

## 测试

```bash
uv run pytest
```

## 环境变量

复制 `.env.example` 为 `.env`，填入 GLM Key（只保存在后端）：

```bash
cp .env.example .env
```

`backend/.env` 已被根目录 `.gitignore` 排除。
