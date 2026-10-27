import type { Asset, QueryInterpretation, SearchHit } from '../lib/types'

interface TopicRule {
  keys: string[]
  assetIds: string[]
  tags: string[]
  semantic?: string
}

const topicRules: TopicRule[] = [
  {
    keys: ['防晒', '夏日照', '清爽'],
    assetIds: ['asset-01', 'asset-09', 'asset-02', 'asset-12', 'asset-13'],
    tags: ['防晒', '夏季', '清爽'],
    semantic: '夏季防晒霜清爽自然光场景图',
  },
  {
    keys: ['耳机', '数码', '桌面'],
    assetIds: ['asset-06', 'asset-11', 'asset-07'],
    tags: ['耳机', '科技', '桌面'],
    semantic: '头戴式耳机桌面科技感场景图',
  },
  {
    keys: ['咖啡', '手冲', '早餐'],
    assetIds: ['asset-07', 'asset-08', 'asset-12'],
    tags: ['咖啡', '暖调', '生活方式'],
    semantic: '暖调手冲咖啡生活方式场景',
  },
  {
    keys: ['母亲节', '礼物', '礼赠', '暖色调'],
    assetIds: ['asset-12', 'asset-03', 'asset-08', 'asset-04'],
    tags: ['母亲节', '礼物', '暖光'],
    semantic: '适合母亲节礼赠的暖色调生活方式素材',
  },
  {
    keys: ['通勤', '穿搭', '职场'],
    assetIds: ['asset-04', 'asset-10', 'asset-11', 'asset-05'],
    tags: ['通勤', '街拍', '都市'],
    semantic: '都市通勤穿搭与包袋街拍',
  },
  {
    keys: ['家居', '客厅', '软装', '奶油风'],
    assetIds: ['asset-08', 'asset-12', 'asset-07', 'asset-03'],
    tags: ['家居', '奶油风', '温暖'],
    semantic: '奶油风客厅与温暖家居场景',
  },
  {
    keys: ['跑鞋', '运动', '鞋'],
    assetIds: ['asset-05', 'asset-10', 'asset-06'],
    tags: ['跑鞋', '运动', '复古'],
    semantic: '复古跑鞋产品特写与运动生活方式',
  },
  {
    keys: ['香氛', '香水', '木质'],
    assetIds: ['asset-03', 'asset-08', 'asset-12'],
    tags: ['香氛', '木质调', '暖光'],
    semantic: '木质调香氛暖光氛围场景',
  },
  {
    keys: ['文案', '小红书', '选题'],
    assetIds: ['asset-15', 'asset-13', 'asset-16'],
    tags: ['小红书', '文案', '选题'],
    semantic: '小红书夏季护肤选题与文案素材',
  },
  {
    keys: ['报告', '趋势', '行业'],
    assetIds: ['asset-13', 'asset-15', 'asset-01'],
    tags: ['行业报告', '趋势', '防晒'],
    semantic: '夏季防晒品类趋势报告',
  },
]

const noResultPatterns = ['无人机', '不存在的素材', '火星', '宠物粮']

function matchTopic(query: string) {
  return topicRules.find((rule) => rule.keys.some((key) => query.includes(key)))
}

export function interpretQuery(query: string): QueryInterpretation {
  const topic = matchTopic(query)
  const fileTypes: string[] = []

  if (/图|场景|画面|视觉|海报/.test(query)) fileTypes.push('image')
  if (/文档|报告|PDF|规范/.test(query)) fileTypes.push('pdf', 'docx')
  if (/文案|选题|笔记|Markdown/i.test(query)) fileTypes.push('md', 'txt')

  let category: string | undefined
  if (query.includes('场景')) category = '场景图'
  if (query.includes('产品')) category = '产品图'
  if (query.includes('模特') || query.includes('街拍')) category = '模特图'

  return {
    semanticQuery: topic?.semantic ?? (query.replace(/帮我|找一些|找几张|适合|的/g, '').trim() || query),
    filters: {
      fileTypes: fileTypes.length ? fileTypes : ['image'],
      category,
      tags: topic?.tags ?? [],
      createdAfter: undefined,
    },
    mode: '混合检索 · 向量 60% + 关键词 40%',
    notes: topic
      ? `识别到「${topic.tags.slice(0, 3).join('、')}」等语义，优先返回图片素材。`
      : '未识别到明确品类，按语义相似度返回图片素材。',
  }
}

function scoreFor(query: string, asset: Asset, topic?: TopicRule) {
  let score = 0.6
  const topicRank = topic?.assetIds.indexOf(asset.id) ?? -1
  if (topicRank >= 0) score += 0.3 - topicRank * 0.035

  if (query.includes(asset.category)) score += 0.05
  const tagHits = asset.tags.filter((tag) => query.includes(tag)).length
  score += Math.min(tagHits * 0.035, 0.1)

  if (query.includes('暖') && asset.tags.some((tag) => ['暖调', '暖光', '温暖', '暖色'].includes(tag))) {
    score += 0.04
  }
  if (query.includes('清爽') && asset.tags.includes('清爽')) score += 0.03
  if (query.includes('留白') && asset.tags.includes('留白')) score += 0.03

  score += Math.min(asset.usageCount * 0.004, 0.025)
  return Math.min(Number(score.toFixed(2)), 0.97)
}

function reasonFor(query: string, asset: Asset, topic?: TopicRule) {
  const hits = Array.from(
    new Set([
      ...asset.tags.filter((tag) => query.includes(tag)),
      ...(topic?.tags.filter((tag) => asset.tags.includes(tag)) ?? []),
    ]),
  ).slice(0, 4)

  if (hits.length) {
    return `命中标签「${hits.join('、')}」；${
      asset.tags.includes('自然光') ? '画面包含自然光与留白，' : ''
    }与你的场景描述语义接近。`
  }
  if (topic) {
    return `与「${topic.tags.slice(0, 2).join('、')}」语义接近，画面内容可作为「${asset.category}」使用。`
  }
  return `内容摘要与「${query.slice(0, 14)}」语义接近，分类为「${asset.category}」。`
}

function snippetFor(asset: Asset) {
  return asset.chunks[0]?.content ?? asset.summary
}

export function searchAssets(query: string, assets: Asset[]): SearchHit[] {
  const clean = query.trim()
  if (!clean || noResultPatterns.some((pattern) => clean.includes(pattern))) return []

  const interpretation = interpretQuery(clean)
  const topic = matchTopic(clean)
  const wantsImage = interpretation.filters.fileTypes.includes('image')

  let pool = assets.filter((asset) => asset.status === 'ready')
  if (wantsImage) {
    const images = pool.filter((asset) => asset.fileType === 'image')
    if (images.length) pool = images
  }

  const hits = pool
    .map((asset) => ({
      asset,
      score: scoreFor(clean, asset, topic),
      matchReason: reasonFor(clean, asset, topic),
      snippet: snippetFor(asset),
    }))
    .sort((a, b) => b.score - a.score)

  if (topic) {
    const ordered = topic.assetIds
      .map((id) => hits.find((hit) => hit.asset.id === id))
      .filter((hit): hit is SearchHit => Boolean(hit))
    return ordered.slice(0, 5)
  }

  return hits.filter((hit) => hit.score >= 0.66).slice(0, 6)
}

export function getSuggestedAssets(query: string, assets: Asset[]) {
  const hits = searchAssets(query, assets)
  if (hits.length) return hits.slice(0, 3).map((hit) => hit.asset)
  return assets.filter((asset) => asset.status === 'ready').slice(0, 3)
}
