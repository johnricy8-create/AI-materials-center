import {
  ArrowUpRight,
  Bot,
  CornerDownLeft,
  LayoutDashboard,
  Library,
  ListChecks,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import { useUI } from '../lib/ui'
import { AssetThumb, TypeBadge } from './ui'

const pages = [
  { label: '总览', path: '/', icon: LayoutDashboard, hint: 'Dashboard' },
  { label: '素材库', path: '/library', icon: Library, hint: 'Library' },
  { label: '智能搜索', path: '/search', icon: Search, hint: 'Search' },
  { label: 'AI 工作台', path: '/copilot', icon: Bot, hint: 'Copilot' },
  { label: '任务中心', path: '/tasks', icon: ListChecks, hint: 'Tasks' },
  { label: '设置', path: '/settings', icon: Settings, hint: 'Settings' },
]

export function CommandPalette() {
  const { commandOpen, setCommandOpen, openAsset } = useUI()
  const { assets } = useAssets()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [commandOpen])

  const filteredPages = useMemo(() => {
    if (!query.trim()) return pages.slice(0, 4)
    return pages.filter((page) => page.label.includes(query) || page.hint.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  const filteredAssets = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return assets
      .filter((asset) => {
        if (!clean) return asset.status === 'ready'
        return (
          asset.name.toLowerCase().includes(clean) ||
          asset.category.toLowerCase().includes(clean) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(clean))
        )
      })
      .slice(0, query.trim() ? 6 : 4)
  }, [assets, query])

  if (!commandOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/25 px-4 pt-[10vh] backdrop-blur-[3px]"
      onMouseDown={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-[620px] animate-scale-in overflow-hidden rounded-2xl border border-white/20 bg-[#fbfaf7] shadow-[0_30px_100px_-20px_rgba(24,22,17,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCommandOpen(false)
              if (event.key === 'Enter') {
                if (filteredAssets[0]) {
                  openAsset(filteredAssets[0].id)
                  setCommandOpen(false)
                } else if (filteredPages[0]) {
                  navigate(filteredPages[0].path)
                  setCommandOpen(false)
                }
              }
            }}
            placeholder="搜索素材、页面，或输入一句话…"
            className="h-14 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <span className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[9px] text-faint">ESC</span>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-2">
          {filteredPages.length ? (
            <div className="mb-2">
              <p className="px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-faint">页面</p>
              {filteredPages.map((page) => (
                <button
                  key={page.path}
                  onClick={() => {
                    navigate(page.path)
                    setCommandOpen(false)
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white"
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-white text-muted shadow-sm">
                    <page.icon className="size-3.5" />
                  </span>
                  <span className="flex-1 text-[12px] font-medium text-ink">{page.label}</span>
                  <span className="text-[9px] text-faint">{page.hint}</span>
                  <ArrowUpRight className="size-3 text-faint opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ) : null}

          {filteredAssets.length ? (
            <div>
              <div className="flex items-center justify-between px-2.5 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-faint">
                  {query.trim() ? '素材结果' : '最近素材'}
                </p>
                {query.trim() ? (
                  <button
                    className="text-[9px] font-semibold text-accent"
                    onClick={() => {
                      navigate(`/search?q=${encodeURIComponent(query)}`)
                      setCommandOpen(false)
                    }}
                  >
                    在智能搜索中打开
                  </button>
                ) : null}
              </div>
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    openAsset(asset.id)
                    setCommandOpen(false)
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white"
                >
                  <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-canvas">
                    <AssetThumb asset={asset} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-[12px] font-medium text-ink">{asset.name}</span>
                    <span className="mt-0.5 block text-[9px] text-faint">
                      {asset.category} · {asset.tags.slice(0, 2).join(' / ')}
                    </span>
                  </span>
                  <TypeBadge type={asset.fileType} />
                </button>
              ))}
            </div>
          ) : null}

          {!filteredPages.length && !filteredAssets.length ? (
            <div className="px-5 py-12 text-center">
              <Sparkles className="mx-auto size-5 text-faint" />
              <p className="mt-3 text-[12px] font-semibold text-ink">没有找到匹配内容</p>
              <p className="mt-1 text-[11px] text-muted">试试“防晒”“通勤”或直接打开 AI 工作台。</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-white/55 px-4 py-2.5 text-[9px] text-faint">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-2.5" /> 打开
          </span>
          <span>ESC 关闭</span>
          <span className="ml-auto flex items-center gap-1">
            <Sparkles className="size-2.5 text-accent" />
            也可以直接提问
          </span>
        </div>
      </div>
    </div>
  )
}
