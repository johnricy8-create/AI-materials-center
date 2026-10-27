import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  checkBackend,
  deleteAssetRemote,
  fetchAssetDetail,
  fetchAssets,
  mapApiAsset,
  reanalyzeAssetRemote,
  uploadAssetFiles,
  type ApiUploadResponse,
} from '../api/client'
import { mockAssets } from '../data/assets'
import type { Asset } from './types'

interface AssetContextValue {
  assets: Asset[]
  live: boolean
  loading: boolean
  addAsset: (asset: Asset) => void
  upsertAssets: (nextAssets: Asset[]) => void
  updateAsset: (id: string, patch: Partial<Asset>) => void
  removeAsset: (id: string) => void
  refresh: () => Promise<void>
  uploadFiles: (files: File[]) => Promise<ApiUploadResponse | null>
  fetchDetail: (id: string) => Promise<Asset | null>
  deleteRemote: (id: string) => Promise<void>
  reanalyzeRemote: (id: string) => Promise<void>
}

const AssetContext = createContext<AssetContextValue | null>(null)

export function AssetProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(mockAssets)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)

  const mergeAsset = useCallback((asset: Asset) => {
    setAssets((current) => {
      const index = current.findIndex((item) => item.id === asset.id)
      if (index === -1) return [asset, ...current]
      return current.map((item) => (item.id === asset.id ? asset : item))
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await fetchAssets()
      setAssets(list.items.map((item) => mapApiAsset(item)))
      setLive(true)
    } catch {
      setLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const connect = async () => {
      const health = await checkBackend()
      if (cancelled) return
      if (!health) {
        setLoading(false)
        return
      }
      try {
        const list = await fetchAssets()
        if (cancelled) return
        setAssets(list.items.map((item) => mapApiAsset(item)))
        setLive(true)
      } catch {
        if (!cancelled) setLive(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void connect()
    return () => {
      cancelled = true
    }
  }, [])

  const addAsset = useCallback((asset: Asset) => {
    setAssets((current) => [asset, ...current])
  }, [])

  const upsertAssets = useCallback((nextAssets: Asset[]) => {
    setAssets((current) => {
      const map = new Map(current.map((asset) => [asset.id, asset]))
      nextAssets.forEach((asset) => map.set(asset.id, asset))
      return Array.from(map.values())
    })
  }, [])

  const updateAsset = useCallback((id: string, patch: Partial<Asset>) => {
    setAssets((current) =>
      current.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    )
  }, [])

  const removeAsset = useCallback((id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id))
  }, [])

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!live) return null
      const response = await uploadAssetFiles(files)
      response.items.forEach((item) => mergeAsset(mapApiAsset(item.asset)))
      return response
    },
    [live, mergeAsset],
  )

  const fetchDetail = useCallback(
    async (id: string) => {
      if (!live) return null
      const detail = await fetchAssetDetail(id)
      const mapped = mapApiAsset(detail, detail)
      mergeAsset(mapped)
      return mapped
    },
    [live, mergeAsset],
  )

  const deleteRemote = useCallback(
    async (id: string) => {
      if (!live) {
        removeAsset(id)
        return
      }
      await deleteAssetRemote(id)
      removeAsset(id)
    },
    [live, removeAsset],
  )

  const reanalyzeRemote = useCallback(
    async (id: string) => {
      if (!live) return
      await reanalyzeAssetRemote(id)
      updateAsset(id, { status: 'processing', progress: 20, errorMessage: undefined })
      void (async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500))
          try {
            const detail = await fetchAssetDetail(id)
            mergeAsset(mapApiAsset(detail, detail))
            if (detail.status === 'ready' || detail.status === 'failed') break
          } catch {
            break
          }
        }
      })()
    },
    [live, mergeAsset, updateAsset],
  )

  const value = useMemo(
    () => ({
      assets,
      live,
      loading,
      addAsset,
      upsertAssets,
      updateAsset,
      removeAsset,
      refresh,
      uploadFiles,
      fetchDetail,
      deleteRemote,
      reanalyzeRemote,
    }),
    [
      addAsset,
      assets,
      deleteRemote,
      fetchDetail,
      live,
      loading,
      reanalyzeRemote,
      refresh,
      removeAsset,
      updateAsset,
      uploadFiles,
      upsertAssets,
    ],
  )

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>
}

export function useAssets() {
  const context = useContext(AssetContext)
  if (!context) throw new Error('useAssets must be used within AssetProvider')
  return context
}
