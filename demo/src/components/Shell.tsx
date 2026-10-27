import {
  Bell,
  Bot,
  ChevronDown,
  Command,
  LayoutDashboard,
  Library,
  ListChecks,
  Search,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import { useUI } from '../lib/ui'
import { Avatar } from './ui'
import { cn } from '../lib/utils'
import { AssistantDrawer } from './AssistantDrawer'
import { AssetDrawer } from './AssetDrawer'
import { CommandPalette } from './CommandPalette'
import { UploadModal } from './UploadModal'

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, end: true },
  { to: '/library', label: '素材库', icon: Library },
  { to: '/search', label: '智能搜索', icon: Search },
  { to: '/copilot', label: 'AI 工作台', icon: Bot, badge: 'AI' },
  { to: '/tasks', label: '任务中心', icon: ListChecks, badge: '2' },
]

const systemItems = [{ to: '/settings', label: '设置', icon: Settings }]

const pageMeta: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Workspace', title: '总览' },
  '/library': { eyebrow: 'Asset Library', title: '素材库' },
  '/search': { eyebrow: 'Semantic Search', title: '智能搜索' },
  '/copilot': { eyebrow: 'AI Agent', title: 'AI 工作台' },
  '/tasks': { eyebrow: 'Agent Trace', title: '任务中心' },
  '/settings': { eyebrow: 'Settings', title: '设置' },
}

export function Sidebar() {
  const { live, loading } = useAssets()
  return (
    <aside className="sidebar border-r border-line bg-[#f1eee7]/80 px-4 py-5 backdrop-blur-xl">
      <div className="sidebar-brand flex items-center gap-3 px-1">
        <div className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink text-white shadow-sm">
          <Sparkles className="size-4.5 text-[#f8d8c8]" />
          <span className="absolute -right-1 -bottom-1 size-4 rounded-full bg-accent" />
        </div>
        <div className="sidebar-brand-copy min-w-0">
          <p className="text-[15px] font-bold tracking-[-0.02em] text-ink">素材中心</p>
          <p className="mt-0.5 text-[9px] font-bold tracking-[0.18em] text-faint">AI ASSET HUB</p>
        </div>
      </div>

      <button className="sidebar-storage mt-5 flex w-full items-center justify-between rounded-xl border border-line/80 bg-white/55 px-3 py-2.5 text-left transition hover:bg-white">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-ink">Mia 的创意工作区</p>
          <p className="mt-0.5 text-[10px] text-faint">个人空间 · 免费版</p>
        </div>
        <ChevronDown className="size-3.5 shrink-0 text-faint" />
      </button>

      <nav className="mt-6 flex flex-col gap-1">
        <p className="sidebar-label mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
          工作台
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
            title={item.label}
          >
            <item.icon className="size-4 shrink-0" strokeWidth={1.8} />
            <span className="sidebar-label flex-1">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  'sidebar-label rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                  item.badge === 'AI' ? 'bg-accent-soft text-accent' : 'bg-[#e9e4da] text-muted',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <nav className="mt-6 flex flex-col gap-1">
        <p className="sidebar-label mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
          系统
        </p>
        {systemItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
            title={item.label}
          >
            <item.icon className="size-4 shrink-0" strokeWidth={1.8} />
            <span className="sidebar-label flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="sidebar-storage mb-4 rounded-2xl border border-line bg-white/55 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink">存储空间</p>
            <span className="text-[10px] text-muted">24%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e5dfd4]">
            <div className="h-full w-[24%] rounded-full bg-ink" />
          </div>
          <p className="mt-2 text-[10px] leading-4 text-faint">已使用 2.4 GB / 10 GB</p>
        </div>

        <div
          className={cn(
            'sidebar-label mb-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold',
            live ? 'bg-success-soft/80 text-success' : 'bg-warning-soft/75 text-warning',
          )}
        >
          <WandSparkles className="size-3" />
          {loading ? '连接后端…' : live ? 'LIVE · SQLite' : 'DEMO · 模拟数据'}
        </div>

        <NavLink
          to="/settings"
          className="flex items-center gap-2.5 rounded-xl border-t border-line/80 px-1 pt-4 transition hover:opacity-80"
        >
          <Avatar />
          <div className="sidebar-user-copy min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-ink">Mia Chen</p>
            <p className="truncate text-[10px] text-faint">内容运营</p>
          </div>
          <Settings className="sidebar-user-copy size-3.5 text-faint" />
        </NavLink>
      </div>
    </aside>
  )
}

export function Topbar() {
  const { setCommandOpen, setUploadOpen, setAssistantOpen, assistantOpen, notify } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const meta = pageMeta[location.pathname] ?? pageMeta['/']
  const isCopilot = location.pathname === '/copilot'

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line/70 bg-canvas/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="hidden text-[11px] font-semibold tracking-[0.08em] text-faint sm:inline">
          {meta.eyebrow}
        </span>
        <span className="hidden text-faint sm:inline">/</span>
        <span className="truncate text-[13px] font-semibold text-ink">{meta.title}</span>
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="group ml-auto hidden h-9 w-[210px] shrink items-center gap-2 rounded-xl border border-line bg-white/70 px-3 text-left text-[12px] text-faint transition hover:border-line-strong hover:bg-white xl:flex 2xl:w-[300px]"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">搜索素材…</span>
        <span className="flex items-center gap-0.5 rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-faint">
          <Command className="size-2.5" />
          K
        </span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 xl:ml-0">
        <button
          className="icon-btn xl:hidden"
          title="搜索素材（⌘K）"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-4" />
        </button>

        {!isCopilot ? (
          <button
            className={cn(
              'btn hidden h-9 px-3 text-[12px] sm:inline-flex',
              assistantOpen
                ? 'border border-accent/20 bg-accent-soft text-accent'
                : 'border border-line bg-white text-ink hover:border-line-strong',
            )}
            onClick={() => setAssistantOpen(!assistantOpen)}
          >
            <Sparkles className="size-3.5" />
            AI 助手
          </button>
        ) : null}

        <button
          className="btn btn-primary h-9 px-3.5 text-[12px]"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="size-3.5" />
          <span className="hidden sm:inline">上传素材</span>
        </button>

        <button
          className="icon-btn relative"
          title="通知"
          onClick={() => notify('暂无新通知', '解析完成和 Agent 任务会在这里提醒你。')}
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent ring-2 ring-canvas" />
        </button>

        <button
          className="ml-1 transition hover:opacity-80"
          title="设置"
          onClick={() => navigate('/settings')}
        >
          <Avatar />
        </button>
      </div>
    </header>
  )
}

export function MobileNav() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-line bg-white/90 px-1 py-1.5 shadow-[0_18px_60px_-20px_rgba(24,22,17,0.35)] backdrop-blur-xl md:hidden">
      {[...navItems, systemItems[0]].map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-medium text-faint transition',
              isActive && 'bg-accent-soft text-accent',
            )
          }
        >
          <item.icon className="size-4" strokeWidth={1.9} />
          {item.label.replace('智能', '').replace('AI ', '').replace('中心', '')}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const { assistantOpen, setAssistantOpen, setCommandOpen, selectedAssetId, closeAsset } = useUI()
  const isCopilot = location.pathname === '/copilot'

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setAssistantOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setAssistantOpen, setCommandOpen])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    closeAsset()
    setCommandOpen(false)
  }, [location.pathname, closeAsset, setCommandOpen])

  return (
    <div className="app-frame">
      <Sidebar />
      <div className="main-column flex min-h-screen flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {assistantOpen && !isCopilot ? (
        <>
          <button
            className="assistant-scrim"
            aria-label="关闭 AI 助手"
            onClick={() => setAssistantOpen(false)}
          />
          <AssistantDrawer />
        </>
      ) : null}

      <CommandPalette />
      <UploadModal />
      {selectedAssetId ? <AssetDrawer /> : null}
      <MobileNav />
    </div>
  )
}
