import {
  Check,
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAssets } from '../lib/assets'
import type { Asset, AssetKind } from '../lib/types'
import { useUI } from '../lib/ui'
import { cn, extensionOf } from '../lib/utils'
import { ProgressBar } from './ui'

interface PendingFile {
  id: string
  file?: File
  name: string
  size: number
  kind: AssetKind
  preview?: string
  progress: number
  status: 'ready' | 'uploading' | 'done' | 'error'
}

const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'txt', 'md']

function kindOf(name: string): AssetKind | null {
  const ext = extensionOf(name)
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'md') return 'md'
  if (ext === 'txt') return 'txt'
  return null
}

function prettySize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export function UploadModal() {
  const { uploadOpen, setUploadOpen, notify } = useUI()
  const { addAsset, updateAsset, live, uploadFiles, fetchDetail } = useAssets()
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (uploadOpen) {
      setFiles([])
      setUploading(false)
    }
  }, [uploadOpen])

  useEffect(() => {
    if (!uploadOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) setUploadOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setUploadOpen, uploadOpen, uploading])

  if (!uploadOpen) return null

  const addFiles = (incoming: FileList | File[]) => {
    const next: PendingFile[] = []
    Array.from(incoming).forEach((file) => {
      const kind = kindOf(file.name)
      if (!kind) {
        notify('不支持的文件类型', `${file.name} 不在 MVP 支持范围内。`, 'error')
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        notify('文件过大', `${file.name} 超过 25 MB 限制。`, 'error')
        return
      }
      next.push({
        id: `local-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        kind,
        preview: kind === 'image' ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: 'ready',
      })
    })
    setFiles((current) => [...current, ...next])
  }

  const addSample = () => {
    if (files.length >= 5) {
      notify('最多选择 5 个文件', '这是 Demo 的上传限制。')
      return
    }
    setFiles((current) => [
      ...current,
      {
        id: `sample-${Date.now()}`,
        name: '夏日防晒霜_自然光场景.jpg',
        size: 2.4 * 1024 * 1024,
        kind: 'image',
        preview: '/assets/sunscreen.jpg',
        progress: 0,
        status: 'ready',
      },
    ])
  }

  const removeFile = (id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id))
  }

  const createAsset = (pending: PendingFile): Asset => {
    const baseName = pending.name.replace(/\.[^.]+$/, '')
    const isImage = pending.kind === 'image'
    return {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: baseName,
      fileType: pending.kind,
      image: isImage ? pending.preview : undefined,
      coverTone: pending.kind === 'pdf' ? 'sand' : pending.kind === 'md' ? 'rose' : 'slate',
      category: isImage ? '待分类' : '文档',
      tags: ['新上传', '待解析'],
      summary: '素材已上传，AI 正在提取内容并生成摘要、标签与适用场景。',
      description: '上传完成，解析任务已进入队列。',
      status: 'processing',
      size: prettySize(pending.size),
      createdAt: '刚刚',
      updatedAt: '刚刚',
      useCases: [],
      palette: ['#E7E2D8', '#C9C1B2', '#9A9387'],
      confidence: 0,
      usageCount: 0,
      progress: 8,
      chunks: [],
    }
  }

  const startLiveUpload = async () => {
    if (!files.length || uploading) return
    setUploading(true)

    try {
      const payload: File[] = []
      for (const pending of files.filter((file) => file.status === 'ready')) {
        if (pending.file) {
          payload.push(pending.file)
          continue
        }
        if (pending.preview) {
          const response = await fetch(pending.preview)
          const blob = await response.blob()
          payload.push(new File([blob], pending.name, { type: blob.type || 'image/jpeg' }))
        }
      }

      if (!payload.length) {
        notify('没有可上传的文件', '请重新选择文件。', 'error')
        return
      }

      setFiles((current) =>
        current.map((file) =>
          file.status === 'ready' ? { ...file, status: 'uploading', progress: 32 } : file,
        ),
      )

      const response = await uploadFiles(payload)
      if (!response) throw new Error('后端未连接')

      setFiles((current) =>
        current.map((file) => ({ ...file, status: 'done', progress: 100 })),
      )
      notify('上传完成', 'AI 正在解析素材，完成后会自动更新状态。', 'success')
      if (response.errors.length) {
        notify('部分文件上传失败', response.errors.map((item) => item.message).join('；'), 'error')
      }

      void Promise.all(
        response.items.map(async (item) => {
          for (let attempt = 0; attempt < 40; attempt += 1) {
            await sleep(1500)
            const updated = await fetchDetail(item.asset.id)
            if (updated?.status === 'ready' || updated?.status === 'failed') break
          }
        }),
      )
    } catch (error) {
      notify(
        '上传失败',
        error instanceof Error ? error.message : '请检查后端服务是否启动。',
        'error',
      )
      setFiles((current) =>
        current.map((file) =>
          file.status === 'uploading' ? { ...file, status: 'ready', progress: 0 } : file,
        ),
      )
    } finally {
      setUploading(false)
    }
  }

  const startUpload = async () => {
    if (!files.length || uploading) return
    if (live) {
      await startLiveUpload()
      return
    }
    setUploading(true)

    for (const pending of files.filter((file) => file.status === 'ready')) {
      setFiles((current) =>
        current.map((file) =>
          file.id === pending.id ? { ...file, status: 'uploading', progress: 12 } : file,
        ),
      )

      const asset = createAsset(pending)
      addAsset(asset)

      for (let progress = 12; progress <= 100; progress += 11) {
        await sleep(110)
        setFiles((current) =>
          current.map((file) =>
            file.id === pending.id ? { ...file, progress: Math.min(progress, 100) } : file,
          ),
        )
      }

      setFiles((current) =>
        current.map((file) =>
          file.id === pending.id ? { ...file, status: 'done', progress: 100 } : file,
        ),
      )

      window.setTimeout(() => {
        updateAsset(asset.id, {
          status: 'ready',
          progress: 100,
          summary:
            pending.kind === 'image'
              ? '已完成画面理解：明亮自然光产品场景，画面留白充足，适合夏季护肤与生活方式内容。'
              : '已完成文档解析：提取文本并生成摘要、关键词与内容分类。',
          description: 'AI 解析完成，已生成摘要、标签和文本分块，可以开始检索。',
          category: pending.kind === 'image' ? '场景图' : '文档',
          tags:
            pending.kind === 'image'
              ? ['新上传', '产品场景', '自然光', '留白']
              : ['新上传', '文档', '已解析'],
          confidence: pending.kind === 'image' ? 93 : 90,
          useCases: pending.kind === 'image' ? ['商品详情页', '社交媒体配图'] : ['内容参考'],
          chunks: [
            {
              title: pending.kind === 'image' ? '画面描述' : '文本分块 01',
              content:
                pending.kind === 'image'
                  ? '明亮自然光下的产品场景，主体清晰，背景干净，留有文字排版空间。'
                  : '已完成文本提取与分块，可在素材详情中查看解析内容。',
            },
          ],
        })
        notify('解析完成', `${pending.name.replace(/\.[^.]+$/, '')} 现在可以检索和引用。`, 'success')
      }, 3400)
    }

    await sleep(500)
    setUploading(false)
    notify('上传完成', 'AI 正在后台解析素材，稍后即可检索。', 'success')
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const allDone = files.length > 0 && files.every((file) => file.status === 'done')
  const pendingCount = files.filter((file) => file.status === 'ready').length

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[3px]"
      onMouseDown={() => {
        if (!uploading) setUploadOpen(false)
      }}
    >
      <div
        className="w-full max-w-[560px] animate-scale-in overflow-hidden rounded-2xl border border-white/30 bg-[#fbfaf7] shadow-[0_30px_100px_-18px_rgba(24,22,17,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow mb-1">Upload</p>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">上传素材</h2>
            <p className="mt-1 text-[11px] text-muted">上传后自动提取内容、生成摘要与标签。</p>
          </div>
          <button
            className="icon-btn size-8"
            onClick={() => setUploadOpen(false)}
            disabled={uploading}
            title="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              addFiles(event.dataTransfer.files)
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition',
              dragging
                ? 'border-accent bg-accent-soft/60'
                : 'border-line-strong bg-white/55 hover:border-[#cdbfb2] hover:bg-white',
            )}
          >
            <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-white text-accent shadow-sm">
              <CloudUpload className="size-5" />
            </div>
            <p className="text-[13px] font-semibold text-ink">拖拽文件到这里，或点击选择</p>
            <p className="mt-1 text-[10px] text-muted">图片 / PDF / DOCX / TXT / Markdown · 单文件 ≤ 25 MB</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ''
            }}
          />

          <div className="mt-2.5 flex items-center justify-between">
            <button
              onClick={addSample}
              disabled={uploading}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-accent transition hover:text-accent-dark"
            >
              <Sparkles className="size-3" />
              使用示例文件试试
            </button>
            <span className="text-[9px] text-faint">
              {live ? '会真实上传到本地 FastAPI 并调用 AI 解析' : 'Demo 会模拟上传与解析过程'}
            </span>
          </div>

          {files.length ? (
            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5"
                >
                  <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas text-muted">
                    {file.preview ? (
                      <img src={file.preview} alt="" className="h-full w-full object-cover" />
                    ) : file.kind === 'image' ? (
                      <ImageIcon className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[11px] font-semibold text-ink">{file.name}</p>
                      <span className="shrink-0 text-[9px] text-faint">{prettySize(file.size)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={file.progress} className="h-1 flex-1" />
                      <span className="w-12 shrink-0 text-right text-[8px] text-faint">
                        {file.status === 'done'
                          ? '上传完成'
                          : file.status === 'uploading'
                            ? `${file.progress}%`
                            : '等待上传'}
                      </span>
                    </div>
                  </div>
                  {file.status === 'done' ? (
                    <div className="grid size-6 place-items-center rounded-full bg-success-soft text-success">
                      <Check className="size-3" />
                    </div>
                  ) : file.status === 'uploading' ? (
                    <Loader2 className="size-3.5 animate-spin text-accent" />
                  ) : (
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={uploading}
                      className="icon-btn size-6 text-faint hover:text-danger"
                      title="移除"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-white/50 px-5 py-3.5">
          <p className="text-[10px] text-muted">
            {files.length ? `已选择 ${files.length} 个文件 · ${prettySize(totalSize)}` : '尚未选择文件'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn btn-secondary h-9 px-3.5 text-[11px]"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              取消
            </button>
            <button
              className="btn btn-primary h-9 px-4 text-[11px]"
              onClick={allDone ? () => setUploadOpen(false) : startUpload}
              disabled={(!files.length || uploading) && !allDone}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  上传中
                </>
              ) : allDone ? (
                '完成'
              ) : (
                `开始上传${pendingCount ? ` · ${pendingCount}` : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
