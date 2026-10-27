import { AlertCircle, CheckCircle2, File, FileText, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Asset, AssetKind, AssetStatus } from '../lib/types'
import { cn } from '../lib/utils'
import { useUI } from '../lib/ui'

const typeLabels: Record<AssetKind, string> = {
  image: '图片',
  pdf: 'PDF',
  docx: 'DOCX',
  txt: 'TXT',
  md: 'MD',
}

const typeStyles: Record<AssetKind, string> = {
  image: 'bg-[#eef2ea] text-[#4f654d]',
  pdf: 'bg-[#f8eadf] text-[#9a5b2e]',
  docx: 'bg-[#e9edf4] text-[#4c6080]',
  txt: 'bg-[#f3efe5] text-[#75664d]',
  md: 'bg-[#f7e9ec] text-[#8b4e5a]',
}

export function TypeBadge({ type, showLabel = false }: { type: AssetKind; showLabel?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
        typeStyles[type],
      )}
    >
      {type === 'image' ? <FileText className="size-2.5" /> : <File className="size-2.5" />}
      {typeLabels[type]}
    </span>
  )
}

export function StatusPill({ status }: { status: AssetStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">
        <span className="size-1.5 rounded-full bg-success" />
        可检索
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning">
        <span className="size-1.5 animate-pulse-soft rounded-full bg-warning" />
        解析中
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-1 text-[10px] font-semibold text-danger">
      <span className="size-1.5 rounded-full bg-danger" />
      解析失败
    </span>
  )
}

const docTones = {
  sand: { bg: 'linear-gradient(145deg, #f3e8d6 0%, #dfc8a9 100%)', ink: '#6d5132' },
  sage: { bg: 'linear-gradient(145deg, #e6ece0 0%, #c3d0b7 100%)', ink: '#506245' },
  slate: { bg: 'linear-gradient(145deg, #e7e9ec 0%, #c9ced4 100%)', ink: '#4b535d' },
  rose: { bg: 'linear-gradient(145deg, #f6e5e7 0%, #e4c3ca 100%)', ink: '#7c4b57' },
}

export function DocCover({ asset, className }: { asset: Asset; className?: string }) {
  const tone = docTones[asset.coverTone ?? 'sand']
  return (
    <div
      className={cn('relative flex h-full w-full flex-col justify-between overflow-hidden p-4', className)}
      style={{ background: tone.bg, color: tone.ink }}
    >
      <div className="doc-lines absolute inset-x-4 top-14 bottom-14 opacity-40" />
      <div className="relative flex items-center justify-between">
        <span className="rounded-md bg-white/55 px-1.5 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur">
          {typeLabels[asset.fileType]}
        </span>
        <FileText className="size-4 opacity-50" />
      </div>
      <div className="relative mt-auto">
        <div className="mb-2 h-1 w-8 rounded-full bg-current opacity-25" />
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-[-0.01em]">
          {asset.name.replace(/\.[^.]+$/, '')}
        </p>
        <p className="mt-1 text-[10px] opacity-60">
          {asset.pages ? `${asset.pages} 页` : asset.words ? `${asset.words.toLocaleString()} 字` : '文档'}
        </p>
      </div>
    </div>
  )
}

export function AssetThumb({ asset, className }: { asset: Asset; className?: string }) {
  if (asset.image) {
    return (
      <img
        src={asset.image}
        alt={asset.name}
        className={cn('h-full w-full object-cover', className)}
        loading="lazy"
      />
    )
  }
  return <DocCover asset={asset} className={className} />
}

export function ScoreRing({ score, size = 42 }: { score: number; size?: number }) {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.min(Math.max(score, 0), 1)
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full bg-white"
      style={{ width: size, height: size }}
      title={`相关度 ${Math.round(score * 100)}%`}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#eee9df" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#E8552D"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-accent">{Math.round(score * 100)}</span>
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/45 px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-white text-muted shadow-sm">
        {icon ?? <SearchXIcon />}
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

function SearchXIcon() {
  return <FileText className="size-5" />
}

export function Avatar({ name = 'Mia', className }: { name?: string; className?: string }) {
  return (
    <div
      className={cn(
        'grid size-8 place-items-center rounded-full bg-[#2b2923] text-[11px] font-bold text-[#f4efe4]',
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function ToastViewport() {
  const { toasts, dismissToast } = useUI()
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex animate-slide-in items-start gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-[0_18px_50px_-20px_rgba(24,22,17,0.35)]"
        >
          <div
            className={cn(
              'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
              toast.tone === 'success' && 'bg-success-soft text-success',
              toast.tone === 'error' && 'bg-danger-soft text-danger',
              toast.tone === 'default' && 'bg-accent-soft text-accent',
            )}
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="size-3.5" />
            ) : toast.tone === 'error' ? (
              <AlertCircle className="size-3.5" />
            ) : (
              <Info className="size-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{toast.title}</p>
            {toast.description ? <p className="mt-0.5 text-xs leading-5 text-muted">{toast.description}</p> : null}
          </div>
          <button className="text-faint transition hover:text-ink" onClick={() => dismissToast(toast.id)}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-[#ede8df]', className)}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}
