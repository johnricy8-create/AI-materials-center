import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ToastTone = 'default' | 'success' | 'error'

export interface Toast {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

interface UIContextValue {
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  uploadOpen: boolean
  setUploadOpen: (open: boolean) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  selectedAssetId: string | null
  openAsset: (id: string) => void
  closeAsset: () => void
  toasts: Toast[]
  notify: (title: string, description?: string, tone?: ToastTone) => void
  dismissToast: (id: number) => void
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1360,
  )
  const [uploadOpen, setUploadOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((title: string, description?: string, tone: ToastTone = 'default') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, title, description, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3600)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const openAsset = useCallback((id: string) => setSelectedAssetId(id), [])
  const closeAsset = useCallback(() => setSelectedAssetId(null), [])

  const value = useMemo<UIContextValue>(
    () => ({
      assistantOpen,
      setAssistantOpen,
      uploadOpen,
      setUploadOpen,
      commandOpen,
      setCommandOpen,
      selectedAssetId,
      openAsset,
      closeAsset,
      toasts,
      notify,
      dismissToast,
    }),
    [
      assistantOpen,
      closeAsset,
      commandOpen,
      dismissToast,
      notify,
      openAsset,
      selectedAssetId,
      toasts,
      uploadOpen,
    ],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) throw new Error('useUI must be used within UIProvider')
  return context
}
