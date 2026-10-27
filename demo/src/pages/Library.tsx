import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Check,
  Download,
  Grid2X2,
  List,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAssets } from '../lib/assets'
import type { Asset, AssetKind, AssetStatus } from '../lib/types'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'
import {
  AssetThumb,
  EmptyState,
  ProgressBar,
  StatusPill,
  TypeBadge,
} from '../components/ui'

type KindFilter = 'all' | 'image' | 'document' | 'copy'
type StatusFilter = 'all' | AssetStatus
type SortKey = 'recent' | 'name' | 'usage'

const kindTabs: { id: KindFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'document', label: '文档' },
  { id: 'copy', label: '文案' },
]

function matchesKind(asset: Asset, kind: KindFilter) {
  if (kind === 'all') return true
  if (kind === 'image') return asset.fileType === 'image'
  if (kind === 'document') return ['pdf', 'docx'].includes(asset.fileType)
  return ['md', 'txt'].includes(asset.fileType)
}

function AssetCard({ asset }: { asset: Asset }) {
  const { openAsset, notify } = useUI()
  const { live, reanalyzeRemote } = useAssets()

  return (
    <article
      onClick={() => openAsset(asset.id)}
      className="masonry-card group cursor-pointer overflow-hidden rounded-2xl border border-line bg-white transition duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_20px_50px_-28px_rgba(24,22,17,0.35)]"
    >
      <div className="asset-media relative aspect-[4/3] overflow-hidden bg-[#eae5db]">
        <AssetThumb asset={asset} className="transition duration-500 group-hover:scale-[1.025]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <TypeBadge type={asset.fileType} />
          <StatusPill status={asset.status} />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-between gap-2 bg-gradient-to-t from-ink/65 to-transparent p-2.5 pt-8 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation()
              openAsset(asset.id)
            }}
            className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[9px] font-semibold text-ink backdrop-blur transition hover:bg-white"
          >
            查看详情
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              notify('已开始下载', `${asset.name} 正在下载（Demo 模拟）。`, 'success')
            }}
            className="grid size-7 place-items-center rounded-lg bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
            title="下载"
          >
            <Download className="size-3" />
          </button>
        </div>

        {asset.status === 'processing' ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[8px] text-white/75">
              <span>AI 解析中</span>
              <span>{asset.progress ?? 32}%</span>
            </div>
            <ProgressBar value={asset.progress ?? 32} className="mt-1.5 h-1 bg-white/20" />
          </div>
        ) : null}

        {asset.status === 'failed' ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-danger/85 px-3 py-2 text-[8px] text-white backdrop-blur-sm">
            <span>解析失败 · 文档内嵌图片过多</span>
            <button
              onClick={(event) => {
                event.stopPropagation()
                if (live) {
                  void reanalyzeRemote(asset.id)
                    .then(() => notify('已加入重试队列', 'AI 正在重新解析该素材。'))
                    .catch((error: unknown) =>
                      notify(
                        '重试失败',
                        error instanceof Error ? error.message : '请检查后端服务。',
                        'error',
                      ),
                    )
                } else {
                  notify('已加入重试队列', '正在重新解析该文档。')
                }
              }}
              className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 font-semibold"
            >
              重试
            </button>
          </div>
        ) : null}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[12px] font-semibold text-ink">{asset.name}</h3>
          <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[10px] leading-4 text-muted">
          {asset.summary}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {asset.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-[#f4f1ea] px-1.5 py-0.5 text-[9px] text-muted">
              {tag}
            </span>
          ))}
          {asset.tags.length > 3 ? (
            <span className="px-0.5 py-0.5 text-[9px] text-faint">+{asset.tags.length - 3}</span>
          ) : null}
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-[8px] text-faint">
          <span>
            {asset.category} · {asset.size}
          </span>
          <span>{asset.createdAt}</span>
        </div>
      </div>
    </article>
  )
}

function ListRow({ asset }: { asset: Asset }) {
  const { openAsset } = useUI()
  return (
    <button
      onClick={() => openAsset(asset.id)}
      className="group flex w-full items-center gap-3 border-b border-line/70 px-3 py-2.5 text-left transition last:border-0 hover:bg-canvas/40"
    >
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-canvas">
        <AssetThumb asset={asset} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="line-clamp-1 text-[11px] font-semibold text-ink">{asset.name}</p>
          <TypeBadge type={asset.fileType} />
        </div>
        <p className="mt-0.5 line-clamp-1 text-[9px] text-faint">
          {asset.category} · {asset.tags.slice(0, 3).join(' · ')}
        </p>
      </div>
      <div className="hidden w-36 shrink-0 text-[9px] text-faint sm:block">{asset.summary.slice(0, 22)}…</div>
      <div className="w-16 shrink-0">
        <StatusPill status={asset.status} />
      </div>
      <span className="hidden w-14 shrink-0 text-right text-[9px] text-faint md:block">{asset.size}</span>
      <span className="hidden w-16 shrink-0 text-right text-[9px] text-faint lg:block">{asset.createdAt}</span>
      <ArrowUpRight className="size-3 shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

export default function Library() {
  const { assets } = useAssets()
  const { setUploadOpen } = useUI()
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('全部')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const tags = useMemo(
    () => Array.from(new Set(assets.flatMap((asset) => asset.tags))).filter((tag) => !tag.startsWith('新上传')).slice(0, 12),
    [assets],
  )
  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(assets.map((asset) => asset.category)))],
    [assets],
  )

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const list = assets.filter((asset) => {
      if (!matchesKind(asset, kind)) return false
      if (status !== 'all' && asset.status !== status) return false
      if (category !== '全部' && asset.category !== category) return false
      if (activeTag && !asset.tags.includes(activeTag)) return false
      if (clean) {
        const haystack = `${asset.name} ${asset.category} ${asset.summary} ${asset.tags.join(' ')}`.toLowerCase()
        if (!haystack.includes(clean)) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN')
      if (sort === 'usage') return b.usageCount - a.usageCount
      return 0
    })
  }, [activeTag, assets, category, kind, query, sort, status])

  const resetFilters = () => {
    setKind('all')
    setStatus('all')
    setCategory('全部')
    setActiveTag(null)
    setQuery('')
  }

  const activeFilters = [
    status !== 'all' ? { label: status === 'ready' ? '可检索' : status === 'processing' ? '解析中' : '解析失败', clear: () => setStatus('all') } : null,
    category !== '全部' ? { label: category, clear: () => setCategory('全部') } : null,
    activeTag ? { label: `#${activeTag}`, clear: () => setActiveTag(null) } : null,
  ].filter(Boolean) as { label: string; clear: () => void }[]

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Asset Library</p>
          <div className="flex items-baseline gap-2.5">
            <h1 className="page-title">素材库</h1>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-muted shadow-sm">
              {assets.length}
            </span>
          </div>
          <p className="subtle mt-1.5">所有上传、AI 分析与检索状态，都在同一个地方。</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary h-9 text-[11px]" onClick={resetFilters}>
            <RotateCcw className="size-3" />
            重置
          </button>
          <button className="btn btn-primary h-9 text-[11px]" onClick={() => setUploadOpen(true)}>
            <Plus className="size-3.5" />
            上传素材
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white/70 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-[#f2efe8] p-1">
            {kindTabs.map((tab) => {
              const count = assets.filter((asset) => matchesKind(asset, tab.id)).length
              return (
                <button
                  key={tab.id}
                  onClick={() => setKind(tab.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition',
                    kind === tab.id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  {tab.label}
                  <span className={cn('text-[8px]', kind === tab.id ? 'text-accent' : 'text-faint')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-2.5">
            <Search className="size-3.5 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="在素材库中筛选名称、摘要或标签…"
              className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-faint"
            />
            {query ? (
              <button onClick={() => setQuery('')} className="text-faint hover:text-ink">
                <X className="size-3" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 appearance-none rounded-lg border border-line bg-white pl-2.5 pr-7 text-[10px] text-ink outline-none"
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-faint" />
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-8 appearance-none rounded-lg border border-line bg-white pl-2.5 pr-7 text-[10px] text-ink outline-none"
              >
                <option value="recent">最近上传</option>
                <option value="name">名称 A-Z</option>
                <option value="usage">引用最多</option>
              </select>
              <ArrowDownWideNarrow className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-faint" />
            </div>
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              <button
                onClick={() => setView('grid')}
                className={cn('grid size-7 place-items-center rounded-md', view === 'grid' ? 'bg-canvas text-ink' : 'text-faint')}
                title="网格视图"
              >
                <Grid2X2 className="size-3.5" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn('grid size-7 place-items-center rounded-md', view === 'list' ? 'bg-canvas text-ink' : 'text-faint')}
                title="列表视图"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="no-scrollbar mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
          <span className="shrink-0 text-[9px] text-faint">标签</span>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] transition',
                activeTag === tag
                  ? 'border-accent/25 bg-accent-soft text-accent'
                  : 'border-line bg-white text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              #{tag}
            </button>
          ))}
          {activeFilters.length ? (
            <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-[9px] text-faint hover:text-ink">
              <X className="size-2.5" />
              清除筛选
            </button>
          ) : null}
        </div>

        {activeFilters.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/70 pt-2">
            {activeFilters.map((filter) => (
              <button
                key={filter.label}
                onClick={filter.clear}
                className="flex items-center gap-1 rounded-full bg-[#f4f1ea] px-2 py-1 text-[9px] text-muted hover:text-ink"
              >
                {filter.label}
                <X className="size-2.5" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] text-muted">
          找到 <span className="font-semibold text-ink">{filtered.length}</span> 个素材
          <span className="ml-2 text-faint">· 已按 {sort === 'recent' ? '最近上传' : sort === 'name' ? '名称' : '引用次数'} 排序</span>
        </p>
        {view === 'grid' ? (
          <div className="hidden items-center gap-1 text-[9px] text-faint sm:flex">
            <Check className="size-3 text-success" />
            AI 已自动分类
          </div>
        ) : null}
      </div>

      {filtered.length ? (
        view === 'grid' ? (
          <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
            <button
              onClick={() => setUploadOpen(true)}
              className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/35 p-6 text-center transition hover:border-accent/40 hover:bg-white/60"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                <Plus className="size-4" />
              </span>
              <span className="mt-3 text-[11px] font-semibold text-ink">继续添加素材</span>
              <span className="mt-1 text-[9px] text-faint">支持图片、PDF、DOCX、TXT、Markdown</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="hidden items-center gap-3 border-b border-line bg-[#faf8f4] px-3 py-2 text-[8px] font-semibold uppercase tracking-wider text-faint sm:flex">
              <span className="w-12" />
              <span className="flex-1">素材</span>
              <span className="hidden w-36 lg:block">AI 摘要</span>
              <span className="w-16">状态</span>
              <span className="hidden w-14 text-right md:block">大小</span>
              <span className="hidden w-16 text-right lg:block">上传时间</span>
              <span className="w-3" />
            </div>
            {filtered.map((asset) => (
              <ListRow key={asset.id} asset={asset} />
            ))}
          </div>
        )
      ) : (
        <div className="mt-3">
          <EmptyState
            title="没有找到匹配的素材"
            description="试试减少筛选条件，或换一个更宽泛的关键词。也可以直接上传新素材。"
            action={
              <button onClick={resetFilters} className="btn btn-secondary h-9 text-[11px]">
                <RotateCcw className="size-3" />
                重置筛选
              </button>
            }
          />
        </div>
      )}
    </div>
  )
}
