import { ArrowRight, Maximize2, PenLine, RotateCcw, Search, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAssets } from '../lib/assets'
import { useAssistant } from '../lib/assistant'
import { useUI } from '../lib/ui'
import {
  AssistantAvatar,
  Composer,
  CopyPanel,
  MessageBubble,
  StepTimeline,
  useScrollToBottom,
} from './AssistantBits'

export function AssistantDrawer() {
  const { messages, stages, isRunning, lastOutcome, resetConversation, sendMessage } = useAssistant()
  const { live } = useAssets()
  const { setAssistantOpen } = useUI()
  const navigate = useNavigate()
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages, stages, isRunning])

  return (
    <aside className="assistant-drawer border-l border-line bg-[#fbfaf7]">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <AssistantAvatar />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-ink">AI Copilot</p>
            <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[8px] font-bold text-success">
              ONLINE
            </span>
          </div>
          <p className="mt-0.5 text-[9px] text-faint">
            {live ? 'GLM Agent · 真实任务' : 'GLM-4.7-Flash · 演示模式'}
          </p>
        </div>
        <button
          className="icon-btn size-8"
          title="重置对话"
          onClick={resetConversation}
          disabled={isRunning}
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          className="icon-btn size-8"
          title="在 AI 工作台打开"
          onClick={() => navigate('/copilot')}
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          className="icon-btn size-8"
          title="收起"
          onClick={() => setAssistantOpen(false)}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} compact />
          ))}

          {messages.length <= 1 && !isRunning ? (
            <div className="pt-2">
              <p className="eyebrow mb-2.5">可以这样开始</p>
              <div className="space-y-2">
                {[
                  {
                    title: '找一张场景图',
                    detail: '适合夏季防晒霜的清爽自然光场景',
                    icon: Search,
                    prompt: '找一张适合夏季防晒霜的清爽自然光场景图',
                  },
                  {
                    title: '写一版小红书文案',
                    detail: '基于耳机素材，生成种草文案',
                    icon: PenLine,
                    prompt: '为耳机新品写小红书种草文案',
                  },
                  {
                    title: '分析素材方向',
                    detail: '总结品牌视觉规范里的色彩方向',
                    icon: Sparkles,
                    prompt: '分析品牌视觉规范里的色彩方向',
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => sendMessage(item.prompt)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-line bg-white/65 p-3 text-left transition hover:border-accent/25 hover:bg-white hover:shadow-sm"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-accent">
                      <item.icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-ink">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-faint">{item.detail}</span>
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isRunning ? (
            <div className="rounded-2xl border border-line bg-white/70 p-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Sparkles className="size-3 text-accent" />
                <span className="text-[10px] font-semibold text-ink">正在执行</span>
                <span className="ml-auto flex gap-0.5">
                  <span className="typing-dot size-1 rounded-full bg-accent" />
                  <span className="typing-dot size-1 rounded-full bg-accent [animation-delay:140ms]" />
                  <span className="typing-dot size-1 rounded-full bg-accent [animation-delay:280ms]" />
                </span>
              </div>
              <StepTimeline stages={stages} compact />
            </div>
          ) : null}

          {!isRunning && lastOutcome?.copy ? (
            <div className="rounded-2xl border border-accent/15 bg-white p-3.5 shadow-sm">
              <CopyPanel copy={lastOutcome.copy} compact />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-[#fbfaf7] p-3">
        <Composer compact placeholder="问点什么，或让我写一版文案…" />
        <p className="mt-2 text-center text-[8px] text-faint">
          {live ? 'Agent 会调用真实检索与 GLM 生成' : 'Demo 使用模拟数据 · 正式版由后端调用 GLM'}
        </p>
      </div>
    </aside>
  )
}
