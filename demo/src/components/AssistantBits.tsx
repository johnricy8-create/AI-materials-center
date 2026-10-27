import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Send,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import { useAssistant } from '../lib/assistant'
import type { AgentStage, Asset, ChatMessage, CopyResult } from '../lib/types'
import { cn, copyText } from '../lib/utils'
import { useUI } from '../lib/ui'
import { AssetThumb } from './ui'

export function AssistantAvatar({ small = false }: { small?: boolean }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-ink text-[#f8d8c8] shadow-sm',
        small ? 'size-7' : 'size-8',
      )}
    >
      <Sparkles className={small ? 'size-3.5' : 'size-4'} />
    </div>
  )
}

export function MiniAsset({
  asset,
  onClick,
  compact = false,
}: {
  asset: Asset
  onClick?: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-white p-1.5 pr-3 text-left transition hover:border-line-strong hover:shadow-sm',
        compact ? 'w-[168px]' : 'w-[190px]',
      )}
    >
      <div className={cn('shrink-0 overflow-hidden rounded-lg bg-canvas', compact ? 'size-10' : 'size-11')}>
        <AssetThumb asset={asset} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[11px] font-semibold text-ink">{asset.name}</p>
        <p className="mt-0.5 text-[9px] text-faint">{asset.category}</p>
      </div>
      <ChevronRight className="size-3 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  )
}

export function MessageBubble({
  message,
  compact = false,
  showCopyLink = true,
}: {
  message: ChatMessage
  compact?: boolean
  showCopyLink?: boolean
}) {
  const { assets } = useAssets()
  const { openAsset } = useUI()
  const navigate = useNavigate()
  const attached = message.assetIds
    ?.map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is Asset => Boolean(asset))

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-[12px] leading-6 text-[#673826]">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5">
      <AssistantAvatar small={compact} />
      <div className="min-w-0 flex-1">
        <div className="whitespace-pre-wrap text-[12px] leading-6 text-ink">{message.text}</div>

        {attached?.length ? (
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {attached.map((asset) => (
              <MiniAsset
                key={asset.id}
                asset={asset}
                compact={compact}
                onClick={() => openAsset(asset.id)}
              />
            ))}
          </div>
        ) : null}

        {message.copy && showCopyLink ? (
          <button
            onClick={() => navigate('/copilot')}
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl border border-accent/15 bg-accent-soft/60 px-3 py-2 text-left transition hover:bg-accent-soft"
          >
            <div className="grid size-6 place-items-center rounded-lg bg-white text-accent">
              <Sparkles className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold text-[#673826]">{message.copy.headline}</p>
              <p className="text-[9px] text-[#9b6a57]">已生成 3 个版本 · 查看完整结果</p>
            </div>
            <ChevronRight className="size-3 text-[#9b6a57]" />
          </button>
        ) : null}

        {message.copy && !showCopyLink ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-accent/15 bg-accent-soft/55 px-3 py-2">
            <Sparkles className="size-3 text-accent" />
            <p className="min-w-0 flex-1 truncate text-[9px] font-semibold text-[#673826]">
              {message.copy.headline}
            </p>
            <span className="shrink-0 text-[8px] text-[#9b6a57]">右侧可编辑</span>
          </div>
        ) : null}
        <p className="mt-1.5 text-[9px] text-faint">{message.time}</p>
      </div>
    </div>
  )
}

export function StepTimeline({ stages, compact = false }: { stages: AgentStage[]; compact?: boolean }) {
  if (!stages.length) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-white/40 px-4 py-8 text-center">
        <p className="text-[11px] text-muted">发起一次任务后，这里会显示 Agent 的执行步骤。</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {stages.map((stage, index) => (
        <div key={stage.id} className="relative flex gap-2.5 pb-3 last:pb-0">
          {index < stages.length - 1 ? (
            <span
              className={cn(
                'absolute left-[9px] top-5 h-[calc(100%-8px)] w-px',
                stage.status === 'done' ? 'bg-success/30' : 'bg-line',
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border text-[8px]',
              stage.status === 'done' && 'border-success/20 bg-success-soft text-success',
              stage.status === 'running' && 'border-accent/20 bg-accent-soft text-accent',
              stage.status === 'pending' && 'border-line bg-canvas text-faint',
              stage.status === 'failed' && 'border-danger/20 bg-danger-soft text-danger',
            )}
          >
            {stage.status === 'done' ? (
              <Check className="size-2.5" strokeWidth={3} />
            ) : stage.status === 'running' ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : stage.status === 'failed' ? (
              <X className="size-2.5" strokeWidth={3} />
            ) : (
              <span className="size-1 rounded-full bg-current" />
            )}
          </span>
          <div className="min-w-0 flex-1 pt-px">
            <div className="flex items-start justify-between gap-2">
              <p
                className={cn(
                  'text-[11px] font-semibold',
                  stage.status === 'pending' ? 'text-faint' : 'text-ink',
                )}
              >
                {stage.label}
              </p>
              <span className="shrink-0 text-[9px] tabular-nums text-faint">
                {stage.duration ?? (stage.status === 'running' ? '执行中' : '')}
              </span>
            </div>
            {!compact ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted">{stage.detail}</p>
            ) : (
              <p className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-faint">{stage.detail}</p>
            )}
            {stage.tool ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#f1eee8] px-1.5 py-0.5 font-mono text-[8px] text-muted">
                <Terminal className="size-2" />
                {stage.tool}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Composer({
  placeholder = '描述你想要的素材，或让 AI 写一版文案…',
  compact = false,
}: {
  placeholder?: string
  compact?: boolean
}) {
  const { sendMessage, isRunning } = useAssistant()
  const { live } = useAssets()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!value.trim() || isRunning) return
    sendMessage(value)
    setValue('')
    textareaRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-white p-2 transition focus-within:border-[#d3b7aa] focus-within:shadow-[0_0_0_3px_rgba(232,85,45,0.07)]',
        compact ? '' : 'p-2.5',
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="block max-h-32 w-full resize-none bg-transparent px-1.5 py-1 text-[12px] leading-5 text-ink outline-none placeholder:text-faint"
      />
      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1 text-[9px] text-faint">
          <span className="size-1.5 rounded-full bg-success" />
          {live ? 'GLM Agent · 真实任务' : 'GLM-4.7-Flash · 模拟运行'}
        </span>
        <button
          onClick={submit}
          disabled={!value.trim() || isRunning}
          className="grid size-7 place-items-center rounded-lg bg-accent text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-[#d9d3c9]"
          title="发送"
        >
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}

export function CopyPanel({
  copy,
  compact = false,
}: {
  copy: CopyResult
  compact?: boolean
}) {
  const { assets } = useAssets()
  const { openAsset, notify } = useUI()
  const [variantId, setVariantId] = useState(copy.variants[0]?.id ?? '')
  const [draft, setDraft] = useState(copy.variants[0]?.content ?? '')

  useEffect(() => {
    setVariantId(copy.variants[0]?.id ?? '')
    setDraft(copy.variants[0]?.content ?? '')
  }, [copy])

  const usedAssets = useMemo(
    () =>
      copy.usedAssetIds
        .map((id) => assets.find((asset) => asset.id === id))
        .filter((asset): asset is Asset => Boolean(asset)),
    [assets, copy.usedAssetIds],
  )

  const activeVariant = copy.variants.find((variant) => variant.id === variantId)

  const handleCopy = async () => {
    await copyText(`${draft}\n\n${copy.hashtags.join(' ')}`)
    notify('文案已复制', '可以直接粘贴到小红书、商品详情页或广告后台。', 'success')
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Generated Copy</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{copy.headline}</h3>
        </div>
        <span className="chip shrink-0 border-accent/15 bg-accent-soft text-accent">{copy.tone}</span>
      </div>

      <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto rounded-xl bg-[#f4f1ea] p-1">
        {copy.variants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => {
              setVariantId(variant.id)
              setDraft(variant.content)
            }}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition',
              variantId === variant.id
                ? 'bg-white text-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            {variant.label}
          </button>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={cn(
          'mt-3 w-full resize-none rounded-xl border border-line bg-white p-3.5 text-[12px] leading-6 text-ink outline-none transition focus:border-[#d3b7aa] focus:shadow-[0_0_0_3px_rgba(232,85,45,0.06)]',
          compact ? 'h-52' : 'h-64',
        )}
        spellCheck={false}
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9px] text-faint">{draft.length} 字 · 可直接编辑</span>
        <button onClick={handleCopy} className="btn btn-secondary h-8 px-3 text-[11px]">
          <Copy className="size-3" />
          复制文案
        </button>
      </div>

      {!compact ? (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {copy.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#f4f1ea] px-2 py-1 text-[9px] text-muted">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-accent/10 bg-accent-soft/45 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#7c4a37]">
              <Sparkles className="size-3" />
              生成依据
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[#8e6b5d]">{copy.rationale}</p>
          </div>
        </>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold text-muted">
          引用素材 <span className="text-faint">· {usedAssets.length}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {usedAssets.map((asset, index) => (
            <button
              key={asset.id}
              onClick={() => openAsset(asset.id)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white py-1 pl-1 pr-2 text-[9px] text-muted transition hover:border-line-strong hover:text-ink"
            >
              <span className="grid size-5 place-items-center overflow-hidden rounded bg-canvas">
                <AssetThumb asset={asset} />
              </span>
              A{index + 1}
            </button>
          ))}
        </div>
      </div>
      {activeVariant ? <span className="sr-only">{activeVariant.label}</span> : null}
    </div>
  )
}

export function QuickPrompts({
  prompts,
  onPick,
  className,
}: {
  prompts: string[]
  onPick: (prompt: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onPick(prompt)}
          className="rounded-xl border border-line bg-white/70 px-2.5 py-1.5 text-left text-[9px] leading-4 text-muted transition hover:border-accent/30 hover:bg-accent-soft/50 hover:text-[#7c4a37]"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}

export function useScrollToBottom<T extends HTMLElement>(dependency: unknown[]) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, dependency)
  return ref
}

export { AssistantAvatar as AssistantIcon }
