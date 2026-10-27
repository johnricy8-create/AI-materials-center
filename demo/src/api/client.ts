import type { Asset, AssetKind, AssetStatus, CopyResult, SearchHit } from '../lib/types'

const configuredBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1'
export const API_BASE = configuredBase.replace(/\/+$/, '')
export const API_ORIGIN = new URL(API_BASE, window.location.origin).origin

export interface ApiAsset {
  id: string
  name: string
  original_name: string
  file_type: string
  mime_type: string
  file_size: number
  checksum: string
  status: string
  error_message: string | null
  category: string | null
  tags: string[]
  summary: string | null
  description: string | null
  keywords: string[]
  width: number | null
  height: number | null
  page_count: number | null
  char_count: number | null
  ai_model: string | null
  thumbnail_url: string | null
  file_url: string
  created_at: string
  updated_at: string
}

export interface ApiChunk {
  id: string
  chunk_index: number
  content: string
  token_count: number
  meta: Record<string, unknown>
}

export interface ApiAssetDetail extends ApiAsset {
  chunks: ApiChunk[]
  analysis_version: string | null
}

export interface ApiSearchItem {
  asset: ApiAsset
  score: number
  match_reason: string
  snippet: string
}

export interface ApiSearchResponse {
  query: string
  interpreted: {
    semantic_query: string
    tokens: string[]
    filters: Record<string, unknown>
    mode: string
    notes: string
  }
  items: ApiSearchItem[]
  total_candidates: number
  took_ms: number
  mode: string
}

export interface ApiUploadResponse {
  items: { asset: ApiAsset; duplicate: boolean }[]
  errors: { filename: string; message: string }[]
}

export interface ApiHealth {
  status: string
  database: boolean
  storage: boolean
  model_configured: boolean
  version: string
}

export interface ApiAgentStep {
  id: string
  step_index: number
  node_name: string
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  duration_ms: number
  status: string
  error: string | null
  created_at: string
}

export interface ApiAgentCopy {
  headline: string
  tone: string
  variants: { id: string; label: string; content: string }[]
  hashtags: string[]
  rationale: string
  used_asset_ids?: string[]
}

export interface ApiAgentTask {
  id: string
  user_query: string
  intent: string
  status: string
  result: {
    answer: string
    assets: ApiAsset[]
    copy: ApiAgentCopy | null
    intent: string
    retry_count: number
  } | null
  error: string | null
  model_usage: Record<string, unknown>
  created_at: string
  finished_at: string | null
  steps: ApiAgentStep[]
}

export interface ApiStats {
  total: number
  ready: number
  processing: number
  failed: number
  storage_bytes: number
}

const absoluteUrl = (path: string | null | undefined) => {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  return new URL(path, API_ORIGIN).toString()
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

function statusOf(status: string): AssetStatus {
  if (status === 'ready') return 'ready'
  if (status === 'failed') return 'failed'
  return 'processing'
}

function coverToneFor(kind: AssetKind): Asset['coverTone'] {
  if (kind === 'pdf') return 'sand'
  if (kind === 'md') return 'rose'
  if (kind === 'docx') return 'slate'
  return 'sage'
}

export function mapApiAsset(api: ApiAsset, detail?: ApiAssetDetail): Asset {
  const type = (['image', 'pdf', 'docx', 'txt', 'md'].includes(api.file_type)
    ? api.file_type
    : 'txt') as AssetKind
  const image =
    api.thumbnail_url != null
      ? absoluteUrl(api.thumbnail_url)
      : type === 'image'
        ? absoluteUrl(api.file_url)
        : undefined
  return {
    id: api.id,
    name: api.name || api.original_name,
    fileType: type,
    image,
    coverTone: coverToneFor(type),
    category: api.category || (type === 'image' ? '图片' : '文档'),
    tags: api.tags || [],
    summary:
      api.summary ||
      (statusOf(api.status) === 'processing'
        ? 'AI 正在提取内容并生成摘要、标签与分类。'
        : '该素材尚未生成 AI 摘要。'),
    description: api.description || '',
    status: statusOf(api.status),
    size: formatBytes(api.file_size),
    dimensions: api.width && api.height ? `${api.width} × ${api.height}` : undefined,
    pages: api.page_count ?? undefined,
    words: api.char_count ?? undefined,
    createdAt: formatDate(api.created_at),
    updatedAt: formatDate(api.updated_at),
    useCases: type === 'image' ? ['商品详情页', '社交媒体'] : ['内容参考'],
    palette: ['#E7E2D8', '#C9C1B2', '#9A9387', '#F7F4EE'],
    confidence: api.ai_model ? 93 : 0,
    usageCount: 0,
    aiModel: api.ai_model || undefined,
    fileUrl: absoluteUrl(api.file_url),
    chunks: (detail?.chunks || []).map((chunk) => ({
      title: `文本分块 ${String(chunk.chunk_index + 1).padStart(2, '0')}`,
      content: chunk.content,
    })),
    progress: statusOf(api.status) === 'processing' ? 55 : undefined,
    errorMessage: api.error_message || undefined,
  }
}

export function mapSearchHit(item: ApiSearchItem): SearchHit {
  return {
    asset: mapApiAsset(item.asset),
    score: item.score,
    matchReason: item.match_reason,
    snippet: item.snippet,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const payload = await response.json()
      message = payload.detail || message
    } catch {
      // Keep the status message.
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export async function checkBackend(): Promise<ApiHealth | null> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return null
    return (await response.json()) as ApiHealth
  } catch {
    return null
  }
}

export async function fetchAssets(): Promise<{ items: ApiAsset[]; total: number }> {
  return request<{ items: ApiAsset[]; total: number }>('/assets?page=1&page_size=100')
}

export async function fetchAssetDetail(id: string): Promise<ApiAssetDetail> {
  return request<ApiAssetDetail>(`/assets/${id}`)
}

export async function uploadAssetFiles(files: File[]): Promise<ApiUploadResponse> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  return request<ApiUploadResponse>('/assets', { method: 'POST', body: form })
}

export async function deleteAssetRemote(id: string): Promise<void> {
  await request(`/assets/${id}`, { method: 'DELETE' })
}

export async function reanalyzeAssetRemote(id: string): Promise<ApiAsset> {
  return request<ApiAsset>(`/assets/${id}/reanalyze`, { method: 'POST' })
}

export async function searchBackend(query: string, topK = 8): Promise<ApiSearchResponse> {
  return request<ApiSearchResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({ query, top_k: topK, mode: 'hybrid' }),
  })
}

export async function fetchStats(): Promise<ApiStats> {
  return request<ApiStats>('/stats')
}

export async function createAgentTask(query: string): Promise<ApiAgentTask> {
  return request<ApiAgentTask>('/agent/tasks', {
    method: 'POST',
    body: JSON.stringify({ query, mode: 'auto' }),
  })
}

export async function fetchAgentTask(id: string): Promise<ApiAgentTask> {
  return request<ApiAgentTask>(`/agent/tasks/${id}`)
}

export async function listAgentTasks(): Promise<{
  items: ApiAgentTask[]
  total: number
  page: number
  page_size: number
}> {
  return request('/agent/tasks?page=1&page_size=50')
}

export async function retryAgentTask(id: string): Promise<ApiAgentTask> {
  return request<ApiAgentTask>(`/agent/tasks/${id}/retry`, { method: 'POST' })
}

export type { CopyResult }
