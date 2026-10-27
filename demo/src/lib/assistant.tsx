import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createAgentTask,
  fetchAgentTask,
  mapApiAsset,
  type ApiAgentCopy,
  type ApiAgentTask,
} from '../api/client'
import { buildAgentOutcome, type AgentKind, type AgentOutcome } from '../data/agent'
import { useAssets } from './assets'
import type { AgentStage, ChatMessage, CopyResult } from './types'

interface AssistantContextValue {
  messages: ChatMessage[]
  stages: AgentStage[]
  isRunning: boolean
  currentKind: AgentKind | null
  lastOutcome: AgentOutcome | null
  sendMessage: (text: string) => void
  loadTask: (task: ApiAgentTask) => void
  resetConversation: () => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

const welcome: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: '下午好，我是你的素材助手。可以让我帮你找图、分析素材，或者基于已有素材直接写一版文案。',
  time: '刚刚',
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const NODE_META: Record<string, { label: string; detail: string; tool: string }> = {
  understand_intent: {
    label: '理解需求',
    detail: '识别意图，提取检索条件',
    tool: 'understand_intent',
  },
  search_assets: {
    label: '检索素材',
    detail: 'Embedding + 关键词混合召回',
    tool: 'search_assets',
  },
  evaluate_results: {
    label: '结果评估',
    detail: '检查相关性、数量与重试条件',
    tool: 'evaluate_results',
  },
  rewrite_query: {
    label: '改写查询',
    detail: '结果不足时放宽检索条件',
    tool: 'rewrite_query',
  },
  generate_content: {
    label: '生成文案',
    detail: '基于素材生成 3 个版本',
    tool: 'generate_content',
  },
  analyze_asset: {
    label: '分析素材',
    detail: '读取素材摘要与标签',
    tool: 'analyze_asset',
  },
  finalize: {
    label: '整理结果',
    detail: '组装最终回答与引用',
    tool: 'finalize',
  },
}

function stagesFor(kind: AgentKind): AgentStage[] {
  if (kind === 'search') {
    return [
      {
        id: 'intent',
        label: '理解需求',
        detail: '识别意图并提取关键词与筛选条件',
        tool: 'understand_intent',
        status: 'pending',
      },
      {
        id: 'search',
        label: '检索素材',
        detail: '向量召回 + 关键词召回，融合排序',
        tool: 'search_assets',
        status: 'pending',
      },
      {
        id: 'rank',
        label: '整理结果',
        detail: '按相关性排序，生成匹配理由与摘要',
        status: 'pending',
      },
    ]
  }

  if (kind === 'analyze') {
    return [
      {
        id: 'intent',
        label: '理解需求',
        detail: '识别分析目标与需要读取的素材',
        tool: 'understand_intent',
        status: 'pending',
      },
      {
        id: 'read',
        label: '读取素材',
        detail: '读取素材摘要、标签与文本分块',
        tool: 'analyze_asset',
        status: 'pending',
      },
      {
        id: 'compare',
        label: '分析内容',
        detail: '对比品牌资料与行业趋势',
        status: 'pending',
      },
      {
        id: 'suggest',
        label: '生成建议',
        detail: '输出可执行的主视觉方向',
        tool: 'generate_content',
        status: 'pending',
      },
    ]
  }

  return [
    {
      id: 'intent',
      label: '理解需求',
      detail: '识别意图与检索条件',
      tool: 'understand_intent',
      status: 'pending',
    },
    {
      id: 'search',
      label: '检索素材',
      detail: '混合检索候选素材并去重',
      tool: 'search_assets',
      status: 'pending',
    },
    {
      id: 'evaluate',
      label: '结果评估',
      detail: '检查相关性、数量与引用完整性',
      status: 'pending',
    },
    {
      id: 'generate',
      label: '生成文案',
      detail: '生成 3 个版本并校验素材引用',
      tool: 'generate_content',
      status: 'pending',
    },
  ]
}

function outputDetail(output: Record<string, unknown> | null): string {
  if (!output) return ''
  const parts: string[] = []
  if (typeof output.candidates === 'number') parts.push(`候选 ${output.candidates} 条`)
  if (typeof output.rewritten_query === 'string') parts.push(`查询：${output.rewritten_query}`)
  if (Array.isArray(output.assets)) parts.push(`引用 ${output.assets.length} 个素材`)
  if (typeof output.headline === 'string') parts.push(output.headline)
  if (typeof output.answer === 'string') parts.push(output.answer)
  if (output.evaluation && typeof output.evaluation === 'object') {
    const evaluation = output.evaluation as Record<string, unknown>
    if (evaluation.sufficient === false) parts.push('结果不足')
  }
  return parts.join(' · ').slice(0, 120)
}

function stagesFromTask(task: ApiAgentTask): AgentStage[] {
  if (task.steps.length) {
    return task.steps.map((step) => {
      const meta = NODE_META[step.node_name]
      return {
        id: `${step.node_name}-${step.step_index}`,
        label: meta?.label ?? step.node_name,
        detail: step.error || outputDetail(step.output) || meta?.detail || '',
        tool: meta?.tool ?? step.node_name,
        status:
          step.status === 'failed'
            ? 'failed'
            : step.status === 'running'
              ? 'running'
              : 'done',
        duration: `${(step.duration_ms / 1000).toFixed(1)}s`,
      }
    })
  }
  if (task.status === 'queued' || task.status === 'running') {
    return [
      {
        id: 'agent-start',
        label: '理解需求',
        detail: 'Agent 正在分析你的需求…',
        tool: 'understand_intent',
        status: 'running',
      },
    ]
  }
  return []
}

function mapCopy(raw: ApiAgentCopy | null): CopyResult | undefined {
  if (!raw) return undefined
  const variants = (raw.variants || [])
    .filter((variant) => variant.content)
    .map((variant, index) => ({
      id: variant.id || `variant-${index}`,
      label: variant.label || ['小红书文案', '商品介绍', '广告短文案'][index] || '文案',
      content: variant.content,
    }))
  if (!variants.length) return undefined
  return {
    headline: raw.headline || 'AI 生成文案',
    tone: raw.tone || '自然、可信',
    variants,
    hashtags: raw.hashtags || [],
    usedAssetIds: raw.used_asset_ids || [],
    rationale: raw.rationale || '基于检索到的素材生成。',
  }
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { assets, live, upsertAssets } = useAssets()
  const [messages, setMessages] = useState<ChatMessage[]>([welcome])
  const [stages, setStages] = useState<AgentStage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentKind, setCurrentKind] = useState<AgentKind | null>(null)
  const [lastOutcome, setLastOutcome] = useState<AgentOutcome | null>(null)

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => [...current, message])
  }, [])

  const runMock = useCallback(
    async (text: string, kind: AgentKind) => {
      const plan = stagesFor(kind)
      const delays =
        kind === 'search'
          ? [550, 950, 550]
          : kind === 'analyze'
            ? [500, 750, 650, 950]
            : [650, 950, 700, 1100]

      for (let index = 0; index < plan.length; index += 1) {
        setStages((current) =>
          current.map((stage, stageIndex) =>
            stageIndex === index ? { ...stage, status: 'running' } : stage,
          ),
        )
        await sleep(delays[index] ?? 600)
        const duration = `${((delays[index] ?? 600) / 1000).toFixed(1)}s`
        setStages((current) =>
          current.map((stage, stageIndex) =>
            stageIndex === index ? { ...stage, status: 'done', duration } : stage,
          ),
        )
      }

      const outcome = buildAgentOutcome(text, assets)
      setLastOutcome(outcome)
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: outcome.text,
        time: '刚刚',
        assetIds: outcome.assetIds,
        copy: outcome.copy,
        kind: outcome.kind,
      })
      setIsRunning(false)
    },
    [appendMessage, assets],
  )

  const runLive = useCallback(
    async (text: string) => {
      try {
        const created = await createAgentTask(text)
        setStages(stagesFromTask(created))
        for (let attempt = 0; attempt < 120; attempt += 1) {
          await sleep(800)
          const task = await fetchAgentTask(created.id)
          setStages(stagesFromTask(task))
          if (task.status === 'succeeded') {
            const result = task.result
            const resultAssets = (result?.assets || []).map((asset) => mapApiAsset(asset))
            if (resultAssets.length) upsertAssets(resultAssets)
            const copy = mapCopy(result?.copy ?? null)
            const rawKind = result?.intent || task.intent || 'search'
            const kind: AgentKind =
              rawKind === 'generate' ? 'generate' : rawKind === 'analyze' ? 'analyze' : 'search'
            const outcome: AgentOutcome = {
              kind,
              text: result?.answer || '任务已完成。',
              assetIds: resultAssets.map((asset) => asset.id),
              copy,
            }
            setCurrentKind(kind)
            setLastOutcome(outcome)
            appendMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              text: outcome.text,
              time: '刚刚',
              assetIds: outcome.assetIds,
              copy: outcome.copy,
              kind,
            })
            setIsRunning(false)
            return
          }
          if (task.status === 'failed' || task.status === 'canceled') {
            appendMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              text: `任务执行失败：${task.error || '未知错误。'} 可以换一种描述后重试。`,
              time: '刚刚',
            })
            setIsRunning(false)
            return
          }
        }
        appendMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: '任务执行时间较长，已停止等待。可以到任务中心查看状态或重试。',
          time: '刚刚',
        })
        setIsRunning(false)
      } catch {
        appendMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Agent 暂时不可用，先用演示模式为你返回结果。',
          time: '刚刚',
        })
        await runMock(text, currentKind ?? 'generate')
      }
    },
    [appendMessage, currentKind, runMock, upsertAssets],
  )

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || isRunning) return

      const kind: AgentKind = /分析/.test(text)
        ? 'analyze'
        : /写|文案|介绍|标题|种草|生成/.test(text)
          ? 'generate'
          : 'search'

      setIsRunning(true)
      setCurrentKind(kind)
      setLastOutcome(null)
      setStages(stagesFor(kind))
      appendMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        time: '刚刚',
      })

      if (live) {
        void runLive(text)
      } else {
        void runMock(text, kind)
      }
    },
    [appendMessage, isRunning, live, runLive, runMock],
  )

  const loadTask = useCallback(
    (task: ApiAgentTask) => {
      const result = task.result
      const resultAssets = (result?.assets || []).map((asset) => mapApiAsset(asset))
      if (resultAssets.length) upsertAssets(resultAssets)
      const copy = mapCopy(result?.copy ?? null)
      const rawKind = result?.intent || task.intent || 'search'
      const kind: AgentKind =
        rawKind === 'generate' ? 'generate' : rawKind === 'analyze' ? 'analyze' : 'search'
      const outcome: AgentOutcome = {
        kind,
        text: result?.answer || task.error || '任务已完成。',
        assetIds: resultAssets.map((asset) => asset.id),
        copy,
      }
      setCurrentKind(kind)
      setStages(stagesFromTask(task))
      setLastOutcome(outcome)
      setIsRunning(false)
      setMessages([
        welcome,
        {
          id: `user-${task.id}`,
          role: 'user',
          text: task.user_query,
          time: '刚刚',
        },
        {
          id: `assistant-${task.id}`,
          role: 'assistant',
          text: outcome.text,
          time: '刚刚',
          assetIds: outcome.assetIds,
          copy: outcome.copy,
          kind,
        },
      ])
    },
    [upsertAssets],
  )

  const resetConversation = useCallback(() => {
    if (isRunning) return
    setMessages([welcome])
    setStages([])
    setLastOutcome(null)
    setCurrentKind(null)
  }, [isRunning])

  const value = useMemo(
    () => ({
      messages,
      stages,
      isRunning,
      currentKind,
      lastOutcome,
      sendMessage,
      loadTask,
      resetConversation,
    }),
    [
      currentKind,
      isRunning,
      lastOutcome,
      loadTask,
      messages,
      resetConversation,
      sendMessage,
      stages,
    ],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useAssistant must be used within AssistantProvider')
  return context
}
