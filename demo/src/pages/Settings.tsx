import {
  Check,
  ChevronRight,
  Cpu,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  Loader2,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { useAssets } from '../lib/assets'
import { useUI } from '../lib/ui'
import { cn } from '../lib/utils'

function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition',
        checked ? 'bg-accent' : 'bg-[#ddd7cc]',
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

export default function Settings() {
  const { notify } = useUI()
  const { assets, live } = useAssets()
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [hybrid, setHybrid] = useState(true)
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [vision, setVision] = useState(true)
  const [rerank, setRerank] = useState(false)

  const testConnection = () => {
    setTesting(true)
    window.setTimeout(() => {
      setTesting(false)
      notify('连接测试通过（演示）', 'GLM-4.7-Flash 配置格式正确；正式接入时会真实调用模型。', 'success')
    }, 1600)
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Settings</p>
          <h1 className="page-title">设置</h1>
          <p className="subtle mt-1.5">模型、存储和检索配置。敏感信息只保存在后端环境变量中。</p>
        </div>
        <button
          onClick={() => notify('设置已保存', 'Demo 环境仅保存在当前页面状态中。', 'success')}
          className="btn btn-primary h-9 text-[11px]"
        >
          <Save className="size-3.5" />
          保存设置
        </button>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warning/15 bg-warning-soft/55 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="text-[11px] font-semibold text-warning">
            {live ? '已连接本地后端 · M1' : '当前为 M0 高保真 Demo'}
          </p>
          <p className="mt-1 text-[9px] leading-5 text-[#967544]">
            {live
              ? '素材与解析状态来自 FastAPI + SQLite；GLM-4.7-Flash / GLM-4V 已接入后端，API Key 不会进入浏览器。'
              : '页面使用模拟数据，不会读取或上传 API Key。正式开发时，GLM-4.7-Flash Key 只写入后端 .env 并通过服务端调用。'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <Sparkles className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">模型服务</p>
                <p className="mt-0.5 text-[9px] text-faint">OpenAI-compatible · 智谱 GLM</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-1 text-[8px] font-bold text-success">
                <span className="size-1.5 rounded-full bg-success" />
                已配置
              </span>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-semibold text-muted">文本模型</label>
                  <div className="field flex h-9 items-center bg-[#faf8f4] text-[11px]">GLM-4.7-Flash</div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-semibold text-muted">供应商</label>
                  <div className="field flex h-9 items-center bg-[#faf8f4] text-[11px]">智谱开放平台</div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-semibold text-muted">Base URL</label>
                <div className="field flex h-9 items-center bg-[#faf8f4] font-mono text-[10px]">
                  https://open.bigmodel.cn/api/paas/v4
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-line bg-[#f8f6f1] px-3 py-2.5">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                <p className="text-[9px] leading-5 text-muted">
                  图片理解使用同账号可用的 GLM-4V 系列；Embedding 使用 embedding-3，固定 1024 维。
                  具体型号以账号权限为准。
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-semibold text-muted">API Key</label>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-[#faf8f4] px-3">
                  <span className="flex-1 truncate font-mono text-[10px] text-muted">
                    {showKey ? '已隐藏 · 仅后端环境变量可读取' : '••••••••••••••••••••••••••••••••'}
                  </span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-faint transition hover:text-ink"
                    title={showKey ? '隐藏' : '显示状态'}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[8px] text-faint">
                  <ShieldCheck className="size-2.5 text-success" />
                  Demo 不会在浏览器中存储密钥；正式版保存至 <code className="font-mono">backend/.env</code>
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-line pt-4">
                <button onClick={testConnection} disabled={testing} className="btn btn-secondary h-8 text-[10px]">
                  {testing ? <Loader2 className="size-3 animate-spin" /> : <TestTube2 className="size-3" />}
                  {testing ? '测试中…' : '测试连接'}
                </button>
                <span className="text-[9px] text-faint">上次检查：未在 Demo 中发起真实请求</span>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-xl bg-[#e9edf4] text-[#4c6080]">
                <Database className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">数据库</p>
                <p className="mt-0.5 text-[9px] text-faint">当前按临时 SQLite 方案执行</p>
              </div>
              <span className="rounded-full bg-[#f2efe8] px-2 py-1 text-[8px] font-bold text-muted">
                SQLite · TEMP
              </span>
            </div>
            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-semibold text-muted">数据库文件</label>
                  <div className="field flex h-9 items-center bg-[#faf8f4] font-mono text-[10px]">
                    backend/data/asset_hub.db
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-semibold text-muted">向量检索</label>
                  <div className="field flex h-9 items-center bg-[#faf8f4] text-[10px]">
                    SQLite JSON 向量（M3 临时）
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-[#f8f6f1] p-3">
                <ChevronRight className="mt-0.5 size-3 shrink-0 text-accent" />
                <p className="text-[9px] leading-5 text-muted">
                  临时 SQLite 仅用于快速跑通闭环。正式版迁移到 PostgreSQL 16 + pgvector；数据模型和仓储接口会提前抽象，减少迁移成本。
                </p>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-xl bg-[#e9f0e7] text-[#4f654d]">
                <Zap className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">解析与检索</p>
                <p className="mt-0.5 text-[9px] text-faint">控制索引质量与模型成本</p>
              </div>
            </div>
            <div className="divide-y divide-line/70 px-5">
              {[
                {
                  title: '上传后自动解析',
                  description: '提取文本、生成摘要与标签，并写入索引。',
                  checked: autoAnalyze,
                  onChange: setAutoAnalyze,
                },
                {
                  title: '图片视觉理解',
                  description: '使用多模态模型分析画面、场景与适用性。',
                  checked: vision,
                  onChange: setVision,
                },
                {
                  title: '混合检索（RRF）',
                  description: '向量召回 + 关键词召回，按 RRF 融合排序。',
                  checked: hybrid,
                  onChange: setHybrid,
                },
                {
                  title: 'LLM 重排',
                  description: '对 Top 10 结果二次重排，成本更高。MVP 暂不启用。',
                  checked: rerank,
                  onChange: setRerank,
                },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[9px] leading-4 text-faint">{item.description}</p>
                  </div>
                  <Switch checked={item.checked} onChange={item.onChange} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-ink bg-ink p-5 text-white shadow-[0_22px_60px_-32px_rgba(24,22,17,0.6)]">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-[#f5b39a]" />
              <p className="text-[11px] font-semibold">环境状态</p>
              <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-white/50">
                M0
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: '前端 Demo', value: '运行中', ok: true },
                { label: '素材数据', value: `${assets.length} 条素材`, ok: true },
                { label: 'GLM-4.7-Flash', value: live ? '已接入 · 后端配置' : '已配置 · 待联调', ok: true },
                { label: 'SQLite', value: live ? '已连接' : '待初始化', ok: live },
                { label: 'pgvector', value: '后续迁移', ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[9px]">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      item.ok ? 'bg-[#8cc9a6]' : 'bg-white/25',
                    )}
                  />
                  <span className="text-white/50">{item.label}</span>
                  <span className="ml-auto text-white/80">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[8px] leading-4 text-white/35">
                Demo 不发起真实模型请求。接入后端后，健康检查会验证模型、数据库和存储目录。
              </p>
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="size-3.5 text-muted" />
              <p className="text-[11px] font-semibold text-ink">本地存储</p>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-ink">2.4 GB</p>
              <span className="text-[9px] text-faint">/ 10 GB</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ece7de]">
              <div className="h-full w-[24%] rounded-full bg-ink" />
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3 text-[9px]">
              <div className="flex justify-between">
                <span className="text-faint">原文件</span>
                <span className="text-ink">2.2 GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">缩略图</span>
                <span className="text-ink">184 MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">向量索引</span>
                <span className="text-ink">16 MB</span>
              </div>
            </div>
            <button
              onClick={() => notify('存储管理', '正式版支持清理孤立文件与缩略图缓存。')}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-[#f8f6f1] px-2.5 py-2 text-[9px] text-muted transition hover:text-ink"
            >
              管理存储
              <ChevronRight className="size-3" />
            </button>
          </section>

          <section className="card p-4">
            <div className="flex items-center gap-2">
              <Cpu className="size-3.5 text-muted" />
              <p className="text-[11px] font-semibold text-ink">系统信息</p>
            </div>
            <div className="mt-3 space-y-2 text-[9px]">
              <div className="flex justify-between">
                <span className="text-faint">前端</span>
                <span className="text-ink">React 19 · Vite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">Embedding</span>
                <span className="text-ink">1024 维</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">检索</span>
                <span className="text-ink">Hybrid · RRF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">版本</span>
                <span className="text-ink">v0.1.0-demo</span>
              </div>
            </div>
          </section>

          <button
            onClick={() => notify('演示数据', '清空操作在 Demo 中不可用，避免误删种子素材。')}
            className="w-full rounded-xl border border-dashed border-line-strong px-4 py-3 text-[9px] text-faint transition hover:border-danger/30 hover:text-danger"
          >
            清空演示数据
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[9px] text-faint">
        <Check className="size-3 text-success" />
        配置仅为演示状态 · 正式版通过后端环境变量与启动检查加载
      </div>
    </div>
  )
}
