import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import type { Asset } from '../lib/types'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'
import { AssetThumb, ProgressBar, StatusPill, TypeBadge } from './ui'

const tabs = [
  { id: 'ai', label: 'AI 分析' },
  { id: 'chunks', label: '文本分块' },
  { id: 'tasks', label: '任务记录' },
] as const

type TabId = (typeof tabs)[number]['id']

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5 last:border-0">
      <span className="text-[10px] text-faint">{label}</span>
      <span className="text-right text-[11px] font-medium text-ink">{value}</span>
    </div>
  )
}

export function AssetDrawer() {
  const { selectedAssetId, closeAsset, notify } = useUI()
  const {
    assets,
    removeAsset,
    updateAsset,
    live,
    fetchDetail,
    deleteRemote,
    reanalyzeRemote,
  } = useAssets()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('ai')
  const [reanalyzing, setReanalyzing] = useState(false)
  const asset = assets.find((item) => item.id === selectedAssetId)

  useEffect(() => {
    setTab('ai')
    setReanalyzing(false)
    if (selectedAssetId && live) {
      void fetchDetail(selectedAssetId).catch(() => undefined)
    }
  }, [fetchDetail, live, selectedAssetId])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAsset()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeAsset])

  if (!asset) return null

  const handleReanalyze = async () => {
    setReanalyzing(true)
    notify('已加入解析队列', 'AI 正在重新提取内容与标签，完成后会更新结果。')
    if (live) {
      try {
        await reanalyzeRemote(asset.id)
      } catch (error) {
        notify('重新解析失败', error instanceof Error ? error.message : '请稍后重试。', 'error')
      } finally {
        setReanalyzing(false)
      }
      return
    }
    window.setTimeout(() => {
      updateAsset(asset.id, {
        status: 'ready',
        errorMessage: undefined,
        summary: asset.summary || '重新解析完成，已生成新的摘要与标签。',
      })
      setReanalyzing(false)
      notify('重新解析完成', `${asset.name} 的分析结果已更新。`, 'success')
    }, 2600)
  }

  const handleDelete = async () => {
    if (!window.confirm(`确定删除「${asset.name}」吗？原文件与向量分块会一并删除。`)) return
    try {
      if (live) {
        await deleteRemote(asset.id)
      } else {
        removeAsset(asset.id)
      }
      closeAsset()
      notify('素材已删除', '原文件与向量索引已清理。')
    } catch (error) {
      notify('删除失败', error instanceof Error ? error.message : '请稍后重试。', 'error')
    }
  }

  const handleDownload = () => {
    if (asset.fileUrl) {
      window.open(`${asset.fileUrl}?download=true`, '_blank', 'noopener,noreferrer')
      return
    }
    notify('已开始下载', `${asset.name} 正在下载（Demo 模拟）。`, 'success')
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-ink/25 backdrop-blur-[2px]"
      onMouseDown={closeAsset}
    >
      <aside
        className="flex h-full w-full max-w-[520px] animate-slide-in flex-col overflow-y-auto bg-[#fbfaf7] shadow-[-20px_0_80px_-30px_rgba(24,22,17,0.4)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-[#fbfaf7]/90 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <TypeBadge type={asset.fileType} showLabel />
            <StatusPill status={asset.status} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button className="icon-btn" title="下载" onClick={handleDownload}>
              <Download className="size-4" />
            </button>
            <button className="icon-btn" title="删除" onClick={handleDelete}>
              <Trash2 className="size-4" />
            </button>
            <button className="icon-btn" title="关闭" onClick={closeAsset}>
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="p-5">
          <div className="overflow-hidden rounded-2xl bg-[#e9e4da]">
            <div className="aspect-[16/10]">
              <AssetThumb asset={asset} />
            </div>
          </div>

          <div className="mt-5">
            <h2 className="text-[20px] font-semibold leading-snug tracking-[-0.03em] text-ink">
              {asset.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-faint">
              <span>{asset.size}</span>
              {asset.dimensions ? <span>· {asset.dimensions}</span> : null}
              {asset.pages ? <span>· {asset.pages} 页</span> : null}
              {asset.words ? <span>· {asset.words.toLocaleString()} 字</span> : null}
              <span>· {asset.createdAt}</span>
            </div>
          </div>

          {asset.status === 'failed' ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/15 bg-danger-soft/60 p-3.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-danger">解析失败</p>
                <p className="mt-1 text-[10px] leading-5 text-[#9d5c54]">
                  {asset.errorMessage ?? '文件解析失败，请重试。'}
                </p>
                <button
                  onClick={handleReanalyze}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-danger"
                >
                  <RefreshCw className="size-3" />
                  重新解析
                </button>
              </div>
            </div>
          ) : null}

          {asset.status === 'processing' ? (
            <div className="mt-4 rounded-xl border border-warning/15 bg-warning-soft/55 p-3.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                  <RefreshCw className="size-3 animate-spin" />
                  正在生成 AI 分析
                </p>
                <span className="text-[9px] text-warning">{asset.progress ?? 32}%</span>
              </div>
              <ProgressBar value={asset.progress ?? 32} className="mt-2.5 bg-[#e9dcc4]" />
              <p className="mt-2 text-[9px] text-[#9a7c49]">提取内容 → 生成摘要与标签 → 写入向量索引</p>
            </div>
          ) : null}

          <div className="no-scrollbar mt-5 flex gap-1 border-b border-line">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'relative px-3 py-2.5 text-[11px] font-semibold transition',
                  tab === item.id ? 'text-ink' : 'text-faint hover:text-muted',
                )}
              >
                {item.label}
                {tab === item.id ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
                ) : null}
              </button>
            ))}
          </div>

          {tab === 'ai' ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
                    <Sparkles className="size-3 text-accent" />
                    AI 摘要
                  </p>
                  {asset.status === 'ready' ? (
                    <span className="text-[9px] text-success">置信度 {asset.confidence}%</span>
                  ) : null}
                </div>
                <p className="text-[12px] leading-6 text-ink">{asset.summary}</p>
                <p className="mt-3 border-t border-line/70 pt-3 text-[10px] leading-5 text-muted">
                  {asset.description}
                </p>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
                  <Tag className="size-3" />
                  标签
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="chip bg-white text-[10px]">
                      {tag}
                    </span>
                  ))}
                  <button
                    onClick={() => notify('标签编辑', '正式版支持直接修改标签并同步更新检索。')}
                    className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[10px] text-faint transition hover:text-ink"
                  >
                    + 添加
                  </button>
                </div>
              </div>

              {asset.useCases.length ? (
                <div>
                  <p className="mb-2 text-[10px] font-semibold text-muted">适用场景</p>
                  <div className="grid grid-cols-2 gap-2">
                    {asset.useCases.map((useCase) => (
                      <div
                        key={useCase}
                        className="rounded-xl border border-line bg-white/65 px-3 py-2 text-[10px] text-ink"
                      >
                        {useCase}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-line bg-white px-4 py-1">
                <MetaRow label="分类" value={asset.category} />
                <MetaRow label="文件类型" value={asset.fileType.toUpperCase()} />
                <MetaRow label="引用次数" value={`${asset.usageCount} 次`} />
                <MetaRow label="最近更新" value={asset.updatedAt} />
                <MetaRow label="解析模型" value={asset.aiModel ?? 'GLM-4.7-Flash / 4V'} />
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold text-muted">主色提取</p>
                <div className="flex gap-2">
                  {asset.palette.map((color) => (
                    <div key={color} className="flex-1">
                      <div className="h-9 rounded-lg border border-black/5" style={{ background: color }} />
                      <p className="mt-1 text-center text-[8px] uppercase text-faint">{color}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'chunks' ? (
            <div className="mt-4 space-y-2.5">
              {asset.chunks.length ? (
                asset.chunks.map((chunk, index) => (
                  <div key={`${chunk.title}-${index}`} className="rounded-xl border border-line bg-white p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-ink">{chunk.title}</p>
                      <span className="font-mono text-[8px] text-faint">chunk_{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-6 text-muted">{chunk.content}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[8px] text-faint">
                      <CheckCircle2 className="size-2.5 text-success" />
                      已向量化 · 1024 维
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-[11px] text-muted">
                  暂无文本分块
                </div>
              )}
            </div>
          ) : null}

          {tab === 'tasks' ? (
            <div className="mt-4 space-y-2.5">
              <div className="rounded-xl border border-line bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-ink">自动解析素材</p>
                    <p className="mt-1 text-[9px] text-faint">提取文本 → 生成元数据 → 向量化</p>
                  </div>
                  <span className="chip border-success/15 bg-success-soft text-[9px] text-success">成功</span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[9px] text-faint">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-2.5" /> 3.8s
                  </span>
                  <span>GLM-4.7-Flash</span>
                  <button
                    onClick={() => {
                      closeAsset()
                      navigate('/tasks')
                    }}
                    className="ml-auto flex items-center gap-1 font-semibold text-accent"
                  >
                    查看任务
                    <ExternalLink className="size-2.5" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-white/55 p-3.5 text-[10px] leading-5 text-muted">
                该素材被 3 个 Agent 任务引用，最近一次用于「为这款防晒霜找 3 张清爽场景图，并写一段小红书文案」。
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-line bg-[#fbfaf7]/90 px-5 py-3.5 backdrop-blur-xl">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="btn btn-secondary h-9 flex-1 text-[11px]"
          >
            <RefreshCw className={cn('size-3', reanalyzing && 'animate-spin')} />
            {reanalyzing ? '解析中…' : '重新分析'}
          </button>
          <button onClick={handleDownload} className="btn btn-primary h-9 flex-1 text-[11px]">
            <Download className="size-3" />
            下载原文件
          </button>
        </div>
      </aside>
    </div>
  )
}
