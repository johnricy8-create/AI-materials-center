import {
  ArrowRight,
  Bot,
  Filter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Split,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mapSearchHit, searchBackend } from '../api/client'
import { interpretQuery, searchAssets } from '../data/search'
import type { SearchHit } from '../lib/types'
import { useAssets } from '../lib/assets'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'
import { AssetThumb, EmptyState, ScoreRing, TypeBadge } from '../components/ui'

const sampleQuery = '适合夏季防晒霜的清爽场景图'
const suggestions = ['夏季防晒场景图', '母亲节暖色调素材', '耳机桌面场景', '通勤穿搭街拍']

export default function SearchPage() {
  const { assets, live } = useAssets()
  const { openAsset, setAssistantOpen, notify } = useUI()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? sampleQuery
  const [input, setInput] = useState(urlQuery)
  const [submitted, setSubmitted] = useState(urlQuery)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('全部')
  const [remoteHits, setRemoteHits] = useState<SearchHit[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteTook, setRemoteTook] = useState(0)
  const [remoteNotes, setRemoteNotes] = useState('')
  const [remoteTokens, setRemoteTokens] = useState<string[]>([])
  const [remoteMode, setRemoteMode] = useState<'keyword' | 'hybrid'>('keyword')
  const [remoteFailed, setRemoteFailed] = useState(false)

  useEffect(() => {
    setInput(urlQuery)
    setLoading(true)
    const timer = window.setTimeout(() => {
      setSubmitted(urlQuery)
      setLoading(false)
    }, 480)
    return () => window.clearTimeout(timer)
  }, [urlQuery])

  const runSearch = (query: string) => {
    const clean = query.trim()
    if (!clean) return
    setCategory('全部')
    if (clean === submitted) {
      setLoading(true)
      window.setTimeout(() => setLoading(false), 420)
      return
    }
    setSearchParams({ q: clean })
  }

  useEffect(() => {
    if (!live) {
      setRemoteHits([])
      setRemoteLoading(false)
      setRemoteFailed(false)
      return
    }
    let cancelled = false
    setRemoteLoading(true)
    setRemoteFailed(false)
    searchBackend(submitted)
      .then((response) => {
        if (cancelled) return
        setRemoteHits(response.items.map(mapSearchHit))
        setRemoteTook(response.took_ms)
        setRemoteNotes(response.interpreted.notes)
        setRemoteTokens(response.interpreted.tokens || [])
        setRemoteMode(response.mode === 'hybrid' ? 'hybrid' : 'keyword')
      })
      .catch(() => {
        if (!cancelled) setRemoteFailed(true)
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [live, submitted])

  const interpretation = useMemo(() => interpretQuery(submitted), [submitted])
  const localHits = useMemo(() => searchAssets(submitted, assets), [assets, submitted])
  const hits = live && !remoteFailed ? remoteHits : localHits
  const isLoading = loading || (live && remoteLoading)
  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(hits.map((hit) => hit.asset.category)))],
    [hits],
  )
  const filtered = category === '全部' ? hits : hits.filter((hit) => hit.asset.category === category)

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Semantic Search</p>
          <h1 className="page-title">智能搜索</h1>
          <p className="subtle mt-1.5">不用记住文件名，描述你想要的画面、场景和用途。</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-faint">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-2.5 py-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            {live ? 'SQLite 已连接' : '向量索引已就绪'}
          </span>
          <span className="rounded-full border border-line bg-white/70 px-2.5 py-1.5">
            {live ? (remoteMode === 'hybrid' ? 'M3 混合检索' : 'M1 关键词检索') : '1024 维'}
          </span>
        </div>
      </div>

      <section className="relative mt-5 overflow-hidden rounded-[24px] border border-ink bg-ink px-5 py-7 text-white shadow-[0_28px_80px_-38px_rgba(24,22,17,0.65)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-[#6d8b68]/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[#f5b39a]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
              Ask in natural language
            </span>
          </div>
          <h2 className="mt-3 max-w-2xl text-balance text-[26px] font-medium leading-[1.25] tracking-[-0.04em] sm:text-[32px]">
            一句话，找到对的素材。
          </h2>
          <p className="mt-2 max-w-xl text-[11px] leading-5 text-white/45">
            AI 会先理解你的需求，再同时做语义召回和关键词匹配，并说明每条结果为什么相关。
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-xl">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Search className="size-4" />
            </div>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch(input)
              }}
              placeholder="例如：适合夏季防晒霜的清爽场景图"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
            {input ? (
              <button onClick={() => setInput('')} className="text-faint hover:text-ink">
                <X className="size-3.5" />
              </button>
            ) : null}
            <button
              onClick={() => runSearch(input)}
              className="btn btn-primary h-9 shrink-0 px-4 text-[11px]"
            >
              搜索
              <ArrowRight className="size-3" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] text-white/30">试试</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  runSearch(suggestion)
                }}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] text-white/60 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-3 mx-3 rounded-2xl border border-line bg-white p-4 shadow-[0_18px_50px_-32px_rgba(24,22,17,0.35)] sm:mx-5 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-lg bg-accent-soft text-accent">
            <WandSparkles className="size-3" />
          </span>
          <p className="text-[10px] font-semibold text-ink">AI 理解</p>
          <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[8px] font-bold text-success">
            已解析
          </span>
          <span className="ml-auto text-[9px] text-faint">查询改写 + 意图过滤</span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr]">
          <div className="rounded-xl bg-[#f8f6f1] p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-faint">语义查询</p>
            <p className="mt-1.5 text-[11px] font-medium leading-5 text-ink">
              {live ? submitted : interpretation.semanticQuery}
            </p>
          </div>
          <div className="rounded-xl bg-[#f8f6f1] p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-faint">识别筛选</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {live ? (
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-muted">全部类型</span>
              ) : (
                <>
                  {interpretation.filters.fileTypes.map((type) => (
                    <span key={type} className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-muted">
                      {type === 'image' ? '图片' : type.toUpperCase()}
                    </span>
                  ))}
                  {interpretation.filters.category ? (
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-muted">
                      {interpretation.filters.category}
                    </span>
                  ) : null}
                </>
              )}
              {(live ? remoteTokens : interpretation.filters.tags).slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[9px] text-accent">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[#f8f6f1] p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-faint">检索策略</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink">
              <Split className="size-3 text-accent" />
              {live
                ? remoteMode === 'hybrid'
                  ? '混合检索 · Embedding + 关键词'
                  : '关键词检索 · M1'
                : '混合检索 · RRF'}
            </p>
            <p className="mt-1 text-[8px] text-faint">
              {live
                ? remoteMode === 'hybrid'
                  ? 'Embedding-3 + jieba + RRF'
                  : 'SQLite 元数据 + jieba 关键词'
                : '向量 60% + 关键词 40%'}
            </p>
          </div>
        </div>
        <p className="mt-2.5 text-[9px] leading-4 text-faint">
          {live ? remoteNotes || interpretation.notes : interpretation.notes}
        </p>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">
            {isLoading ? '正在检索…' : `找到 ${filtered.length} 个相关素材`}
          </p>
          <p className="mt-0.5 text-[9px] text-faint">
            {isLoading
              ? live
                ? remoteMode === 'hybrid'
                  ? '向量召回 · 关键词召回 · 融合排序'
                  : 'SQLite 关键词召回 · 元数据排序'
                : '向量召回 · 关键词召回 · 融合排序'
              : `${live ? (remoteMode === 'hybrid' ? '混合检索' : '关键词检索') : '混合检索'}耗时 ${
                  live ? remoteTook : hits.length ? 620 + hits.length * 22 : 480
                } ms · 已按相关性排序`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="size-3 text-faint" />
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[9px] transition',
                category === item
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className="card flex gap-4 p-3">
              <div className="skeleton h-28 w-40 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2.5 py-1">
                <div className="skeleton h-3 w-2/5 rounded" />
                <div className="skeleton h-2.5 w-4/5 rounded" />
                <div className="skeleton h-2.5 w-3/5 rounded" />
                <div className="skeleton mt-4 h-8 w-full rounded-lg" />
              </div>
            </div>
          ))
        ) : filtered.length ? (
          filtered.map((hit, index) => (
            <article
              key={hit.asset.id}
              onClick={() => openAsset(hit.asset.id)}
              className="card group animate-fade-up cursor-pointer p-3 transition duration-300 hover:border-line-strong hover:shadow-[0_20px_50px_-30px_rgba(24,22,17,0.4)]"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl bg-canvas sm:h-[132px] sm:w-[172px]">
                  <AssetThumb
                    asset={hit.asset}
                    className="transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute left-2 top-2">
                    <TypeBadge type={hit.asset.fileType} showLabel />
                  </div>
                  <span className="absolute right-2 top-2 rounded-full bg-ink/55 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur">
                    #{index + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-[14px] font-semibold tracking-[-0.02em] text-ink">
                        {hit.asset.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-muted">{hit.asset.summary}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ScoreRing score={hit.score} />
                      <div className="hidden text-right sm:block">
                        <p className="text-[9px] font-semibold text-ink">相关度</p>
                        <p className="text-[8px] text-faint">
                          {live && remoteMode !== 'hybrid' ? '关键词 + 元数据' : 'cosine + RRF'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-accent/10 bg-accent-soft/45 px-2.5 py-2">
                    <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                    <p className="text-[9px] leading-4 text-[#7c4a37]">
                      <span className="font-semibold">匹配理由：</span>
                      {hit.matchReason}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {hit.asset.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-md bg-[#f4f1ea] px-1.5 py-0.5 text-[8px] text-muted">
                        {tag}
                      </span>
                    ))}
                    <span className="ml-auto hidden text-[8px] text-faint lg:block">
                      引用片段：{hit.snippet.slice(0, 24)}…
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-end justify-end gap-1.5 sm:flex-col sm:items-stretch sm:justify-between">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      setAssistantOpen(true)
                      notify('已加入 AI 工作台', '在右侧对话框里描述文案需求即可。', 'success')
                    }}
                    className="btn btn-secondary h-8 flex-1 px-2.5 text-[9px] sm:flex-none"
                  >
                    <Bot className="size-3" />
                    加入文案
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      openAsset(hit.asset.id)
                    }}
                    className="btn btn-ghost h-8 flex-1 px-2.5 text-[9px] sm:flex-none"
                  >
                    查看
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={<Search className="size-5" />}
            title="这次没有找到足够相关的素材"
            description={`没有素材能匹配「${submitted}」。可以放宽筛选条件、换一种描述，或让 AI 工作台先给一些方向。`}
            action={
              <div className="flex gap-2">
                <button
                  onClick={() => runSearch('夏日清爽场景图')}
                  className="btn btn-secondary h-9 text-[11px]"
                >
                  试试「夏日清爽场景图」
                </button>
                <button
                  onClick={() => setAssistantOpen(true)}
                  className="btn btn-primary h-9 text-[11px]"
                >
                  <Sparkles className="size-3" />
                  去 AI 工作台
                </button>
              </div>
            }
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/50 px-4 py-3">
        <div className="flex items-center gap-2 text-[9px] text-faint">
          <Loader2 className="size-3" />
          {isLoading
            ? '正在计算相关度…'
            : `搜索结果来自 ${assets.filter((asset) => asset.status === 'ready').length} 个已就绪素材，解析中的素材暂不参与检索。`}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-faint">
          <button
            onClick={() => {
              setInput('无人机航拍海景')
              runSearch('无人机航拍海景')
            }}
            className="flex items-center gap-1 transition hover:text-ink"
          >
            <Plus className="size-2.5" />
            测试无结果
          </button>
          <span className="text-line-strong">·</span>
          <span>{live ? (remoteMode === 'hybrid' ? 'SQLite · M3' : 'SQLite · M1') : '向量库 pgvector'}</span>
        </div>
      </div>
    </div>
  )
}
