import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RotateCcw,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchAgentTask } from '../api/client'
import { examplePrompts } from '../data/agent'
import { useAssets } from '../lib/assets'
import { useAssistant } from '../lib/assistant'
import type { Asset } from '../lib/types'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'
import {
  AssistantAvatar,
  Composer,
  CopyPanel,
  MessageBubble,
  QuickPrompts,
  StepTimeline,
  useScrollToBottom,
} from '../components/AssistantBits'
import { AssetThumb } from '../components/ui'

const kindLabel = {
  search: '素材搜索',
  generate: '文案生成',
  analyze: '素材分析',
}

function ReferenceAsset({ asset }: { asset: Asset }) {
  const { openAsset } = useUI()
  return (
    <button
      onClick={() => openAsset(asset.id)}
      className="group overflow-hidden rounded-xl border border-line bg-white text-left transition hover:border-line-strong hover:shadow-sm"
    >
      <div className="aspect-[16/10] overflow-hidden bg-canvas">
        <AssetThumb asset={asset} className="transition duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="p-2">
        <p className="line-clamp-1 text-[9px] font-semibold text-ink">{asset.name}</p>
        <p className="mt-0.5 text-[8px] text-faint">{asset.category}</p>
      </div>
    </button>
  )
}

export default function Copilot() {
  const {
    messages,
    stages,
    isRunning,
    currentKind,
    lastOutcome,
    sendMessage,
    loadTask,
    resetConversation,
  } = useAssistant()
  const { assets, loading, live } = useAssets()
  const [searchParams] = useSearchParams()
  const autoRan = useRef(false)
  const loadedTask = useRef(false)
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages, stages, isRunning])

  useEffect(() => {
    const taskId = searchParams.get('task')
    if (!taskId || loadedTask.current) return
    loadedTask.current = true
    void fetchAgentTask(taskId)
      .then((task) => loadTask(task))
      .catch(() => undefined)
  }, [loadTask, searchParams])

  useEffect(() => {
    if (
      loading ||
      searchParams.get('demo') !== 'run' ||
      autoRan.current ||
      messages.length > 1 ||
      isRunning
    ) {
      return
    }
    autoRan.current = true
    window.setTimeout(() => sendMessage(examplePrompts[0]), 450)
  }, [isRunning, loading, messages.length, searchParams, sendMessage])

  const outcomeAssets = useMemo(() => {
    const ids = lastOutcome?.assetIds ?? []
    return ids
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is Asset => Boolean(asset))
  }, [assets, lastOutcome])

  const totalDuration = stages
    .map((stage) => parseFloat(stage.duration ?? '0'))
    .reduce((sum, duration) => sum + duration, 0)

  const status = isRunning ? 'running' : lastOutcome ? 'done' : 'idle'

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">AI Agent Workbench</p>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title">AI 工作台</h1>
            <span className="rounded-full border border-success/15 bg-success-soft px-2 py-0.5 text-[8px] font-bold text-success">
              GLM-4.7-Flash
            </span>
          </div>
          <p className="subtle mt-1.5">找素材、分析内容、写文案。每一步工具调用都可以回看。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/tasks"
            className="btn btn-secondary h-9 text-[10px]"
          >
            <Terminal className="size-3" />
            任务记录
          </Link>
          <button
            onClick={resetConversation}
            disabled={isRunning}
            className="btn btn-secondary h-9 text-[10px]"
          >
            <RotateCcw className="size-3" />
            新对话
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] xl:h-[calc(100vh-190px)]">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
            <AssistantAvatar />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-ink">素材 Copilot</p>
                <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[7px] font-bold text-success">
                  ONLINE
                </span>
              </div>
              <p className="mt-0.5 text-[8px] text-faint">
                {live ? '真实 Agent · 任务轮询' : '模拟运行 · 工具调用会记录到 Task Trace'}
              </p>
            </div>
            <div className="hidden items-center gap-1.5 text-[8px] text-faint sm:flex">
              <span className="size-1.5 rounded-full bg-success" />
              {live ? 'Agent 在线' : '演示连接'}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#fcfbf8] px-4 py-4">
            <div className="space-y-5">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} showCopyLink={false} />
              ))}

              {isRunning ? (
                <div className="ml-10 animate-fade-up rounded-2xl border border-line bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
                      <Loader2 className="size-3 animate-spin text-accent" />
                      正在执行
                    </span>
                    <span className="text-[8px] text-faint">
                      {currentKind ? kindLabel[currentKind] : '分析中'}
                    </span>
                    <span className="ml-auto flex gap-0.5">
                      <span className="typing-dot size-1 rounded-full bg-accent" />
                      <span className="typing-dot size-1 rounded-full bg-accent [animation-delay:140ms]" />
                      <span className="typing-dot size-1 rounded-full bg-accent [animation-delay:280ms]" />
                    </span>
                  </div>
                  <StepTimeline stages={stages} />
                </div>
              ) : null}

              {messages.length <= 1 && !isRunning ? (
                <div className="ml-10 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { title: '找一张场景图', text: '适合夏季防晒霜的清爽自然光场景' },
                    { title: '写一版文案', text: '为耳机新品写小红书种草文案' },
                    { title: '分析一批素材', text: '总结品牌视觉规范里的色彩方向' },
                  ].map((item) => (
                    <button
                      key={item.title}
                      onClick={() => sendMessage(item.text)}
                      className="rounded-xl border border-line bg-white p-3 text-left transition hover:border-accent/25 hover:bg-accent-soft/30"
                    >
                      <p className="text-[10px] font-semibold text-ink">{item.title}</p>
                      <p className="mt-1.5 text-[9px] leading-4 text-muted">{item.text}</p>
                      <ArrowRight className="mt-2 size-3 text-accent" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-white p-3">
            {messages.length <= 1 && !isRunning ? (
              <QuickPrompts prompts={examplePrompts} onPick={sendMessage} className="mb-2.5" />
            ) : null}
            <Composer placeholder="描述你的素材需求，或让 AI 基于已有素材写一版文案…" />
            <p className="mt-2 text-center text-[8px] text-faint">
              {live
                ? 'Agent 会调用真实混合检索与 GLM 生成；任务记录可在任务中心查看。'
                : 'Agent 会真实调用检索与生成工具；当前 Demo 使用模拟数据，正式版由后端执行。'}
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-24 xl:h-[calc(100vh-190px)] xl:overflow-y-auto xl:pr-1">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="eyebrow mb-1">Run Trace</p>
                <p className="text-[13px] font-semibold text-ink">执行详情</p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[8px] font-bold',
                  status === 'running' && 'bg-warning-soft text-warning',
                  status === 'done' && 'bg-success-soft text-success',
                  status === 'idle' && 'bg-[#f2efe8] text-faint',
                )}
              >
                {status === 'running' ? '运行中' : status === 'done' ? '已完成' : '等待任务'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-[#f8f6f1] px-2 py-2">
                <p className="text-[8px] text-faint">意图</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-ink">
                  {currentKind ? kindLabel[currentKind] : lastOutcome ? kindLabel[lastOutcome.kind] : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-[#f8f6f1] px-2 py-2">
                <p className="text-[8px] text-faint">步骤</p>
                <p className="mt-0.5 text-[10px] font-semibold text-ink">
                  {stages.filter((stage) => stage.status === 'done').length}/{stages.length || '—'}
                </p>
              </div>
              <div className="rounded-lg bg-[#f8f6f1] px-2 py-2">
                <p className="text-[8px] text-faint">耗时</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-ink">
                  <Clock3 className="size-2.5 text-faint" />
                  {totalDuration ? `${totalDuration.toFixed(1)}s` : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <StepTimeline stages={stages} />
            </div>

            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#f8f6f1] px-2.5 py-2 text-[8px] text-faint">
              <CheckCircle2 className="size-2.5 text-success" />
              {isRunning
                ? live
                  ? '任务节点通过轮询实时同步'
                  : '节点事件通过 SSE 推送'
                : '每步输入 / 输出会保存到 agent_task_steps'}
            </div>
          </div>

          {lastOutcome?.copy ? (
            <div className="rounded-2xl border border-accent/20 bg-white p-4 shadow-[0_18px_50px_-32px_rgba(232,85,45,0.4)]">
              <CopyPanel copy={lastOutcome.copy} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong bg-white/40 px-4 py-8 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                <Sparkles className="size-4" />
              </div>
              <p className="mt-3 text-[11px] font-semibold text-ink">文案会出现在这里</p>
              <p className="mt-1 text-[9px] leading-4 text-muted">
                发送一个「找素材 + 写文案」的需求，Agent 会展示引用素材和可编辑结果。
              </p>
            </div>
          )}

          {outcomeAssets.length ? (
            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-ink">引用素材</p>
                <span className="text-[9px] text-faint">{outcomeAssets.length} 个</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {outcomeAssets.map((asset) => (
                  <ReferenceAsset key={asset.id} asset={asset} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-line bg-white/55 px-3 py-2 text-[8px] text-faint">
            <span>trace_id · demo-{lastOutcome?.kind ?? 'idle'}-001</span>
            <Link to="/tasks" className="flex items-center gap-1 font-semibold text-accent">
              查看完整记录
              <ExternalLink className="size-2.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
