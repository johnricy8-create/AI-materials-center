import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Library,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  WandSparkles,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import { useUI } from '../lib/ui'
import { cn, greeting } from '../lib/utils'
import { AssetThumb, ProgressBar, StatusPill, TypeBadge } from '../components/ui'

function StatCard({
  label,
  value,
  detail,
  icon,
  dark = false,
  accent,
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  dark?: boolean
  accent?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5',
        dark
          ? 'border-ink bg-ink text-white shadow-[0_18px_50px_-25px_rgba(24,22,17,0.55)]'
          : 'border-line bg-white shadow-[var(--shadow-card)]',
      )}
    >
      {dark ? (
        <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-accent/20 blur-2xl" />
      ) : null}
      <div className="flex items-start justify-between">
        <span className={cn('text-[10px] font-semibold', dark ? 'text-white/55' : 'text-faint')}>
          {label}
        </span>
        <span
          className={cn(
            'grid size-7 place-items-center rounded-lg',
            dark ? 'bg-white/10 text-[#f5d2c2]' : 'bg-canvas text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <p className={cn('mt-3 text-[30px] font-semibold leading-none tracking-[-0.05em]', dark ? 'text-white' : 'text-ink')}>
        {value}
      </p>
      <p className={cn('mt-2 text-[9px]', dark ? 'text-white/45' : 'text-faint')}>{detail}</p>
      {accent ? (
        <span
          className={cn(
            'absolute bottom-4 right-4 rounded-full px-1.5 py-0.5 text-[8px] font-bold',
            dark ? 'bg-white/10 text-[#f5d2c2]' : 'bg-accent-soft text-accent',
          )}
        >
          {accent}
        </span>
      ) : null}
    </div>
  )
}

export default function Dashboard() {
  const { assets, updateAsset, live, reanalyzeRemote } = useAssets()
  const { openAsset, notify } = useUI()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const ready = assets.filter((asset) => asset.status === 'ready').length
  const processing = assets.filter((asset) => asset.status === 'processing').length
  const failed = assets.filter((asset) => asset.status === 'failed').length
  const recent = assets.slice(0, 4)
  const pending = assets.filter((asset) => asset.status !== 'ready').slice(0, 2)

  const runSearch = () => {
    if (!query.trim()) {
      navigate('/search')
      return
    }
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="mx-auto max-w-[1320px]">
      <section className="animate-fade-up">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow mb-2 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-accent" />
              {greeting()}，Mia
            </p>
            <h1 className="page-title max-w-2xl">
              今天想从哪一批
              <span className="relative mx-1 inline-block text-accent">
                素材
                <svg
                  className="absolute -bottom-1 left-0 w-full text-accent/30"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                >
                  <path d="M2 6 C 30 1, 70 1, 98 5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </span>
              开始？
            </h1>
            <p className="subtle mt-2 max-w-xl">
              上传之后，AI 会替你理解画面、整理标签，并在你需要时写好一版可以改的文案。
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-faint">
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-white/60 px-2.5 py-1.5">
              <span className="size-1.5 rounded-full bg-success" />
              工作区运行正常
            </span>
            <span className="hidden rounded-full border border-line bg-white/60 px-2.5 py-1.5 sm:inline">
              GLM-4.7-Flash
            </span>
          </div>
        </div>

        <div className="mt-6 flex max-w-3xl items-center gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-[0_14px_44px_-30px_rgba(24,22,17,0.35)] transition focus-within:border-[#d3b7aa] focus-within:shadow-[0_0_0_4px_rgba(232,85,45,0.06)]">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Search className="size-4" />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch()
            }}
            placeholder="试试：适合夏季防晒霜的清爽场景图"
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <button onClick={runSearch} className="btn btn-primary h-9 px-4 text-[11px]">
            开始搜索
            <ArrowRight className="size-3" />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] text-faint">试试</span>
          {['夏季防晒场景图', '母亲节暖色调素材', '通勤穿搭'].map((item) => (
            <button
              key={item}
              onClick={() => navigate(`/search?q=${encodeURIComponent(item)}`)}
              className="rounded-full border border-line bg-white/55 px-2.5 py-1 text-[9px] text-muted transition hover:border-accent/25 hover:bg-accent-soft/50 hover:text-[#7c4a37]"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="素材总量"
          value={String(assets.length)}
          detail={live ? '数据来自本地 SQLite' : '本周新增 7 个素材'}
          icon={<Library className="size-3.5" />}
          dark
          accent={live ? 'LIVE' : '+24%'}
        />
        <StatCard
          label="可检索"
          value={String(ready)}
          detail={`${Math.round((ready / Math.max(assets.length, 1)) * 100)}% 已完成 AI 解析`}
          icon={<CheckCircle2 className="size-3.5" />}
        />
        <StatCard
          label="解析中"
          value={String(processing)}
          detail="正在提取内容与生成标签"
          icon={<Loader2 className="size-3.5 animate-spin" />}
          accent="进行中"
        />
        <StatCard
          label="需要处理"
          value={String(failed)}
          detail="解析失败或待补充信息"
          icon={<AlertCircle className="size-3.5" />}
        />
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="card animate-fade-up delay-1 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="section-title">最近素材</p>
              <p className="mt-1 text-[10px] text-faint">刚刚进入工作区的画面与文档</p>
            </div>
            <button
              onClick={() => navigate('/library')}
              className="flex items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-ink"
            >
              查看全部
              <ArrowRight className="size-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3">
            {recent.map((asset) => (
              <button
                key={asset.id}
                onClick={() => openAsset(asset.id)}
                className="group overflow-hidden rounded-xl border border-line/80 bg-canvas/40 text-left transition hover:border-line-strong hover:bg-white hover:shadow-sm"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <AssetThumb
                    asset={asset}
                    className="transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute left-2 top-2">
                    <TypeBadge type={asset.fileType} />
                  </div>
                  <div className="absolute right-2 top-2">
                    <StatusPill status={asset.status} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-[11px] font-semibold text-ink">{asset.name}</p>
                  <p className="mt-1 line-clamp-1 text-[9px] text-faint">
                    {asset.category} · {asset.tags.slice(0, 2).join(' / ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="relative overflow-hidden rounded-2xl border border-ink bg-ink p-5 text-white shadow-[0_20px_60px_-30px_rgba(24,22,17,0.55)]">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/55">
                  <Sparkles className="size-3 text-[#f5b39a]" />
                  AI INSIGHT
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-bold text-[#f5b39a]">
                  THIS WEEK
                </span>
              </div>
              <p className="mt-4 max-w-[280px] text-[19px] font-medium leading-[1.45] tracking-[-0.03em]">
                {live ? (
                  ready === assets.length ? (
                    <>
                      当前 <span className="text-[#f5b39a]">{assets.length}</span> 个素材
                      <span className="text-[#f5b39a]">已全部完成 AI 解析</span>。
                    </>
                  ) : (
                    <>
                      当前素材库共 <span className="text-[#f5b39a]">{assets.length}</span> 个素材，
                      <span className="text-[#f5b39a]"> {ready} 个已完成 AI 解析</span>。
                    </>
                  )
                ) : (
                  <>
                    「夏日」相关素材被引用 <span className="text-[#f5b39a]">18</span> 次，
                    <span className="text-[#f5b39a]"> 比上周增长 38%</span>。
                  </>
                )}
              </p>
              <p className="mt-2 text-[10px] leading-5 text-white/45">
                {live
                  ? '图片由 GLM-4V 理解，文档由 GLM-4.7-Flash 生成摘要、标签与分类。'
                  : '清爽场景图与自然光产品图最受欢迎，建议补充一组户外通勤场景。'}
              </p>

              <div className="mt-5 flex h-16 items-end gap-2">
                {[36, 52, 42, 68, 55, 84, 70].map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all duration-500',
                        index === 5 ? 'bg-accent' : 'bg-white/15',
                      )}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[8px] text-white/25">
                      {['一', '二', '三', '四', '五', '六', '日'][index]}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(live ? '/library' : '/search?q=夏日清爽场景图')}
                className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold text-[#f5b39a] transition hover:text-white"
              >
                {live ? '查看素材库' : '查看相关素材'}
                <ArrowRight className="size-3" />
              </button>
            </div>
          </section>

          <section className="card flex-1 p-4">
            <div className="flex items-center justify-between">
              <p className="section-title">需要你处理</p>
              <span className="text-[9px] text-faint">{pending.length} 项</span>
            </div>
            <div className="mt-3 space-y-2">
              {pending.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl border border-line/80 bg-canvas/45 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 shrink-0 overflow-hidden rounded-lg">
                      <AssetThumb asset={asset} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[10px] font-semibold text-ink">{asset.name}</p>
                      <p className="mt-0.5 text-[8px] text-faint">
                        {asset.status === 'processing' ? 'AI 正在解析' : '解析失败 · 建议重试'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (asset.status === 'failed') {
                          if (live) {
                            void reanalyzeRemote(asset.id).then(() =>
                              notify('已重新加入队列', '正在重新解析该素材。'),
                            )
                          } else {
                            updateAsset(asset.id, {
                              status: 'processing',
                              progress: 12,
                              errorMessage: undefined,
                            })
                            notify('已重新加入队列', '正在重新解析该素材。')
                          }
                        } else {
                          openAsset(asset.id)
                        }
                      }}
                      className="shrink-0 text-[9px] font-semibold text-accent"
                    >
                      {asset.status === 'processing' ? '查看' : '重试'}
                    </button>
                  </div>
                  {asset.status === 'processing' ? (
                    <ProgressBar value={asset.progress ?? 32} className="mt-2 h-1" />
                  ) : null}
                </div>
              ))}
              {!pending.length ? (
                <div className="rounded-xl bg-success-soft/50 px-3 py-4 text-center text-[10px] text-success">
                  全部素材都已就绪
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          {
            title: '用一句话找素材',
            description: '描述场景、色调和用途，AI 会给出素材与匹配理由。',
            icon: Search,
            path: '/search',
            accent: 'bg-[#e9f0e7] text-[#4f654d]',
          },
          {
            title: '基于素材写文案',
            description: '选好方向，让 Agent 检索、评估并生成可编辑的营销文案。',
            icon: Bot,
            path: '/copilot',
            accent: 'bg-accent-soft text-accent',
          },
          {
            title: '看看 Agent 做了什么',
            description: '逐步查看意图识别、工具调用、耗时和失败原因。',
            icon: WandSparkles,
            path: '/tasks',
            accent: 'bg-[#e9edf4] text-[#4c6080]',
          },
        ].map((item) => (
          <button
            key={item.title}
            onClick={() => navigate(item.path)}
            className="card group flex items-start gap-3.5 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_48px_-28px_rgba(24,22,17,0.35)]"
          >
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', item.accent)}>
              <item.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink">{item.title}</span>
                <ArrowRight className="size-3.5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </span>
              <span className="mt-1 block text-[10px] leading-5 text-muted">{item.description}</span>
            </span>
          </button>
        ))}
      </section>

      <div className="mt-5 flex items-center justify-center gap-2 text-[9px] text-faint">
        <Clock3 className="size-3" />
        {live ? '数据来自本地 SQLite · AI 解析已接入' : '数据为 M0 演示种子数据 · 最后更新于刚刚'}
        <TrendingUp className="ml-2 size-3 text-success" />
        {live ? 'M1 关键词检索' : '检索质量评估待接入'}
      </div>
    </div>
  )
}
