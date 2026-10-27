import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listAgentTasks,
  retryAgentTask,
  type ApiAgentTask,
} from '../api/client'
import { intentLabel, mockTasks } from '../data/tasks'
import { useAssets } from '../lib/assets'
import type { AgentTask, TaskStep } from '../lib/types'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'

const nodeLabels: Record<string, string> = {
  understand_intent: '理解需求',
  search_assets: '检索素材',
  evaluate_results: '结果评估',
  rewrite_query: '改写查询',
  generate_content: '生成文案',
  analyze_asset: '分析素材',
  finalize: '整理结果',
}

function formatTaskTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapApiTask(api: ApiAgentTask): AgentTask {
  const status: AgentTask['status'] =
    api.status === 'succeeded'
      ? 'succeeded'
      : api.status === 'running' || api.status === 'queued'
        ? 'running'
        : 'failed'
  const intent: AgentTask['intent'] = ['search', 'analyze', 'generate', 'recommend'].includes(
    api.intent,
  )
    ? (api.intent as AgentTask['intent'])
    : 'search'
  const durationMs = api.steps.reduce((sum, step) => sum + step.duration_ms, 0)
  const steps: TaskStep[] = api.steps.map((step) => ({
    id: step.id,
    label: nodeLabels[step.node_name] || step.node_name,
    detail:
      step.error ||
      (typeof step.output?.answer === 'string' ? step.output.answer : '') ||
      (typeof step.output?.rewritten_query === 'string'
        ? `查询：${step.output.rewritten_query}`
        : '节点执行完成'),
    duration: `${(step.duration_ms / 1000).toFixed(1)}s`,
    status: step.status === 'failed' ? 'failed' : step.status === 'running' ? 'running' : 'done',
    tool: step.node_name,
    input: step.input ? JSON.stringify(step.input) : undefined,
    output: step.output ? JSON.stringify(step.output) : undefined,
  }))

  return {
    id: api.id,
    query: api.user_query,
    intent,
    status,
    duration: durationMs ? `${(durationMs / 1000).toFixed(1)}s` : '—',
    createdAt: formatTaskTime(api.created_at),
    model: 'GLM-4.7-Flash',
    steps,
    result: api.result?.answer,
    error: api.error || undefined,
  }
}

type TaskFilter = 'all' | AgentTask['status']

const filterTabs: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: '全部任务' },
  { id: 'running', label: '运行中' },
  { id: 'succeeded', label: '已完成' },
  { id: 'failed', label: '失败' },
]

function TaskStatus({ status }: { status: AgentTask['status'] }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-1 text-[9px] font-semibold text-warning">
        <Loader2 className="size-2.5 animate-spin" />
        运行中
      </span>
    )
  }
  if (status === 'succeeded') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-1 text-[9px] font-semibold text-success">
        <Check className="size-2.5" />
        已完成
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-1 text-[9px] font-semibold text-danger">
      <X className="size-2.5" />
      失败
    </span>
  )
}

function StepDetail({ step, index, last }: { step: TaskStep; index: number; last: boolean }) {
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <span
        className={cn(
          'relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[9px]',
          step.status === 'done' && 'border-success/20 bg-success-soft text-success',
          step.status === 'running' && 'border-warning/20 bg-warning-soft text-warning',
          step.status === 'failed' && 'border-danger/20 bg-danger-soft text-danger',
          step.status === 'pending' && 'border-line bg-canvas text-faint',
        )}
      >
        {step.status === 'done' ? (
          <Check className="size-3" strokeWidth={3} />
        ) : step.status === 'running' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : step.status === 'failed' ? (
          <X className="size-3" strokeWidth={3} />
        ) : (
          index + 1
        )}
      </span>
      {!last ? (
        <span className="absolute left-[11px] top-6 h-[calc(100%-16px)] w-px bg-line" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-ink">{step.label}</p>
            <p className="mt-1 text-[10px] leading-5 text-muted">{step.detail}</p>
          </div>
          <span className="shrink-0 text-[9px] tabular-nums text-faint">{step.duration ?? '—'}</span>
        </div>
        {step.tool ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#f2efe8] px-1.5 py-0.5 font-mono text-[8px] text-muted">
            <Terminal className="size-2" />
            {step.tool}
          </span>
        ) : null}
        {step.input || step.output ? (
          <div className="mt-2 space-y-1.5">
            {step.input ? (
              <div className="rounded-lg bg-[#f8f6f1] p-2">
                <p className="text-[7px] font-bold uppercase tracking-widest text-faint">input</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[8px] leading-4 text-muted">
                  {step.input}
                </pre>
              </div>
            ) : null}
            {step.output ? (
              <div className="rounded-lg bg-[#f8f6f1] p-2">
                <p className="text-[7px] font-bold uppercase tracking-widest text-faint">output</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[8px] leading-4 text-muted">
                  {step.output}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<AgentTask[]>(mockTasks)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { notify } = useUI()
  const { live } = useAssets()
  const navigate = useNavigate()

  const reload = useCallback(async () => {
    if (!live) return
    try {
      const response = await listAgentTasks()
      setTasks(response.items.map(mapApiTask))
    } catch {
      // Keep the last known list; the demo fallback remains available.
    }
  }, [live])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => {
      void reload()
    }, 3500)
    return () => window.clearInterval(timer)
  }, [live, reload])

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (filter !== 'all' && task.status !== filter) return false
      if (query.trim() && !task.query.toLowerCase().includes(query.trim().toLowerCase())) return false
      return true
    })
  }, [filter, query, tasks])

  const selected = tasks.find((task) => task.id === selectedId)

  const retry = async (task: AgentTask) => {
    if (live) {
      try {
        await retryAgentTask(task.id)
        notify('已重新提交任务', 'Agent 正在重新执行检索与生成。', 'success')
        setSelectedId(task.id)
        await reload()
      } catch (error) {
        notify(
          '重试失败',
          error instanceof Error ? error.message : '请检查后端 Agent 服务。',
          'error',
        )
      }
      return
    }
    notify('已重新提交任务', 'Agent 正在重新执行检索与生成。')
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: 'running',
              error: undefined,
              duration: '0.6s',
              steps: item.steps.map((step, index) =>
                index === 0
                  ? { ...step, status: 'running', duration: undefined }
                  : step.status === 'failed'
                    ? { ...step, status: 'pending', duration: undefined }
                    : step,
              ),
            }
          : item,
      ),
    )

    window.setTimeout(() => {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: 'succeeded',
                duration: '8.2s',
                result: '重试成功：已完成素材分析并生成 3 条主视觉建议。',
                error: undefined,
                steps: item.steps.map((step, index) => ({
                  ...step,
                  status: 'done',
                  duration: `${(0.6 + index * 0.7).toFixed(1)}s`,
                })),
              }
            : item,
        ),
      )
      notify('任务重试成功', '执行结果与 trace 已更新。', 'success')
    }, 2600)
  }

  const counts = {
    all: tasks.length,
    running: tasks.filter((task) => task.status === 'running').length,
    succeeded: tasks.filter((task) => task.status === 'succeeded').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  }

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Agent Trace</p>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title">任务中心</h1>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[8px] font-bold',
                live ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
              )}
            >
              {live ? 'LIVE AGENT' : 'DEMO DATA'}
            </span>
          </div>
          <p className="subtle mt-1.5">每一次 Agent 执行都有记录：意图、工具调用、耗时和异常。</p>
        </div>
        <button onClick={() => navigate('/copilot')} className="btn btn-primary h-9 text-[11px]">
          <Sparkles className="size-3.5" />
          发起新任务
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {[
          { label: '总任务', value: counts.all, detail: '最近 7 天', icon: Terminal },
          {
            label: '已完成',
            value: counts.succeeded,
            detail: counts.all
              ? `${Math.round((counts.succeeded / counts.all) * 100)}% 成功率`
              : '暂无任务',
            icon: Check,
          },
          { label: '运行中', value: counts.running, detail: '正在执行工具调用', icon: Loader2 },
          { label: '失败', value: counts.failed, detail: '需要人工处理', icon: TriangleAlert },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <span
              className={cn(
                'grid size-8 place-items-center rounded-xl',
                stat.label === '失败'
                  ? 'bg-danger-soft text-danger'
                  : stat.label === '运行中'
                    ? 'bg-warning-soft text-warning'
                    : stat.label === '已完成'
                      ? 'bg-success-soft text-success'
                      : 'bg-canvas text-muted',
              )}
            >
              <stat.icon className={cn('size-3.5', stat.label === '运行中' && 'animate-spin')} />
            </span>
            <div>
              <p className="text-[20px] font-semibold leading-none tracking-[-0.04em] text-ink">
                {stat.value}
              </p>
              <p className="mt-1 text-[9px] text-faint">{stat.label} · {stat.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white/70 p-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-[#f2efe8] p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition',
                  filter === tab.id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                {tab.label}
                <span className={cn('text-[8px]', filter === tab.id ? 'text-accent' : 'text-faint')}>
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5">
            <Search className="size-3.5 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索任务需求…"
              className="h-8 w-full min-w-[160px] bg-transparent text-[10px] outline-none placeholder:text-faint"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="hidden items-center gap-3 border-b border-line bg-[#faf8f4] px-4 py-2.5 text-[8px] font-bold uppercase tracking-[0.12em] text-faint md:flex">
          <span className="w-16">状态</span>
          <span className="flex-1">任务需求</span>
          <span className="w-20">意图</span>
          <span className="w-20">耗时</span>
          <span className="w-28">模型</span>
          <span className="w-20">时间</span>
          <span className="w-4" />
        </div>

        {filtered.length ? (
          filtered.map((task) => (
            <button
              key={task.id}
              onClick={() => setSelectedId(task.id)}
              className="group flex w-full flex-col gap-2.5 border-b border-line/70 px-4 py-3 text-left transition last:border-0 hover:bg-canvas/40 md:flex-row md:items-center md:gap-3"
            >
              <div className="flex w-full items-center justify-between gap-3 md:w-16 md:justify-start">
                <TaskStatus status={task.status} />
                <span className="font-mono text-[8px] text-faint md:hidden">{task.id}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[11px] font-semibold text-ink">{task.query}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[8px] text-faint md:hidden">
                  {intentLabel[task.intent]} · {task.duration} · {task.createdAt}
                </p>
              </div>
              <span className="hidden w-20 text-[9px] text-muted md:block">{intentLabel[task.intent]}</span>
              <span className="hidden w-20 items-center gap-1 text-[9px] text-muted md:flex">
                <Clock3 className="size-2.5 text-faint" />
                {task.duration}
              </span>
              <span className="hidden w-28 truncate text-[9px] text-muted md:block">{task.model}</span>
              <span className="hidden w-20 text-[9px] text-faint md:block">{task.createdAt}</span>
              <ChevronRight className="hidden size-3 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink md:block" />
            </button>
          ))
        ) : (
          <div className="px-6 py-14 text-center">
            <Search className="mx-auto size-5 text-faint" />
            <p className="mt-3 text-[12px] font-semibold text-ink">没有匹配的任务</p>
            <p className="mt-1 text-[10px] text-muted">调整筛选条件或搜索关键词试试。</p>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-faint">
        <Terminal className="size-2.5" />
        节点 trace 保存于 agent_task_steps · 大文本仅保留摘要
      </p>

      {selected ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-ink/25 backdrop-blur-[2px]"
          onMouseDown={() => setSelectedId(null)}
        >
          <aside
            className="flex h-full w-full max-w-[540px] animate-slide-in flex-col overflow-y-auto bg-[#fbfaf7] shadow-[-20px_0_80px_-30px_rgba(24,22,17,0.4)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-[#fbfaf7]/90 px-5 py-3.5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white px-1.5 py-0.5 font-mono text-[9px] text-muted shadow-sm">
                  {selected.id}
                </span>
                <TaskStatus status={selected.status} />
              </div>
              <button className="icon-btn ml-auto" onClick={() => setSelectedId(null)} title="关闭">
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5">
              <p className="eyebrow mb-2">Task Request</p>
              <h2 className="text-[18px] font-semibold leading-7 tracking-[-0.03em] text-ink">
                {selected.query}
              </h2>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-line bg-white p-2.5">
                  <p className="text-[8px] text-faint">意图</p>
                  <p className="mt-1 text-[10px] font-semibold text-ink">{intentLabel[selected.intent]}</p>
                </div>
                <div className="rounded-xl border border-line bg-white p-2.5">
                  <p className="text-[8px] text-faint">总耗时</p>
                  <p className="mt-1 text-[10px] font-semibold text-ink">{selected.duration}</p>
                </div>
                <div className="rounded-xl border border-line bg-white p-2.5">
                  <p className="text-[8px] text-faint">模型</p>
                  <p className="mt-1 truncate text-[10px] font-semibold text-ink">{selected.model}</p>
                </div>
              </div>

              {selected.error ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft/60 p-3.5">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                  <div>
                    <p className="text-[10px] font-semibold text-danger">任务执行失败</p>
                    <p className="mt-1 text-[9px] leading-5 text-[#9b5a50]">{selected.error}</p>
                    {selected.status === 'failed' ? (
                      <button
                        onClick={() => retry(selected)}
                        className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-danger"
                      >
                        <RefreshCw className="size-2.5" />
                        重试任务
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-success/15 bg-success-soft/55 p-3.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <div>
                    <p className="text-[10px] font-semibold text-success">
                      {selected.status === 'running' ? '任务运行中' : '任务执行成功'}
                    </p>
                    <p className="mt-1 text-[9px] leading-5 text-[#537964]">
                      {selected.result ?? '正在等待结果…'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink">执行步骤</p>
                  <span className="text-[8px] text-faint">{selected.steps.length} 个节点</span>
                </div>
                <div>
                  {selected.steps.map((step, index) => (
                    <StepDetail
                      key={step.id}
                      step={step}
                      index={index}
                      last={index === selected.steps.length - 1}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-white/55 px-3 py-2.5 text-[8px] text-faint">
                <span>created_at · {selected.createdAt}</span>
                <span>trace_id · trace_{selected.id.replace('task-', '')}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedId(null)
                    navigate(`/copilot?task=${selected.id}`)
                  }}
                  className="btn btn-secondary h-9 flex-1 text-[10px]"
                >
                  <ExternalLink className="size-3" />
                  在 AI 工作台查看
                </button>
                {selected.status === 'failed' ? (
                  <button
                    onClick={() => retry(selected)}
                    className="btn btn-primary h-9 flex-1 text-[10px]"
                  >
                    <RefreshCw className="size-3" />
                    重新执行
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
