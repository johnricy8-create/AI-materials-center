export type AssetKind = 'image' | 'pdf' | 'docx' | 'txt' | 'md'
export type AssetStatus = 'ready' | 'processing' | 'failed'
export type CoverTone = 'sand' | 'sage' | 'slate' | 'rose'

export interface AssetChunk {
  title: string
  content: string
}

export interface Asset {
  id: string
  name: string
  fileType: AssetKind
  image?: string
  coverTone?: CoverTone
  category: string
  tags: string[]
  summary: string
  description: string
  status: AssetStatus
  size: string
  dimensions?: string
  pages?: number
  words?: number
  createdAt: string
  updatedAt: string
  useCases: string[]
  palette: string[]
  confidence: number
  usageCount: number
  aiModel?: string
  fileUrl?: string
  chunks: AssetChunk[]
  progress?: number
  errorMessage?: string
}

export interface SearchHit {
  asset: Asset
  score: number
  matchReason: string
  snippet: string
}

export interface QueryInterpretation {
  semanticQuery: string
  filters: {
    fileTypes: string[]
    category?: string
    tags: string[]
    createdAfter?: string
  }
  mode: string
  notes: string
}

export interface TaskStep {
  id: string
  label: string
  detail: string
  duration?: string
  status: 'done' | 'running' | 'failed' | 'pending'
  tool?: string
  input?: string
  output?: string
}

export interface AgentTask {
  id: string
  query: string
  intent: 'search' | 'analyze' | 'generate' | 'recommend'
  status: 'succeeded' | 'failed' | 'running'
  duration: string
  createdAt: string
  model: string
  steps: TaskStep[]
  result?: string
  error?: string
}

export interface CopyVariant {
  id: string
  label: string
  content: string
}

export interface CopyResult {
  headline: string
  variants: CopyVariant[]
  hashtags: string[]
  usedAssetIds: string[]
  rationale: string
  tone: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: string
  assetIds?: string[]
  copy?: CopyResult
  kind?: 'search' | 'generate' | 'analyze'
}

export type AgentStageStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AgentStage {
  id: string
  label: string
  detail: string
  tool?: string
  status: AgentStageStatus
  duration?: string
}
