import type { Asset, CopyResult } from '../lib/types'
import { searchAssets } from './search'

export type AgentKind = 'search' | 'generate' | 'analyze'

export interface AgentOutcome {
  kind: AgentKind
  text: string
  assetIds: string[]
  copy?: CopyResult
}

const sunscreenCopy: CopyResult = {
  headline: '把夏天的清爽，装进一瓶防晒里',
  tone: '清爽、可信、有生活感',
  variants: [
    {
      id: 'social',
      label: '小红书文案',
      content:
        '夏天的防晒，最怕厚重和搓泥。\n\n这瓶是最近的真爱：上脸是轻薄的乳液感，推开很快，后续跟妆也不会打架。周末去海边带的就是它，补涂几次也没有闷痘。\n\n📍适合：通勤、约会、短途出行\n☀️使用感：清爽 / 不假白 / 成膜快\n\n夏天的清爽感，是防晒给的。',
    },
    {
      id: 'product',
      label: '商品介绍',
      content:
        '轻薄防晒，给夏天一层看不见的保护。\n\n乳液质地，延展性好，上脸清爽不黏腻；自然光下呈现通透肤感，适合日常通勤与户外出行。可妆前使用，后续底妆更服帖。\n\n适合肤质：中性 / 混合性 / 油性\n使用场景：通勤、约会、短途旅行',
    },
    {
      id: 'ad',
      label: '广告短文案',
      content: '夏天可以很轻。\n轻薄防晒，清爽成膜，出门只带这一瓶。\n\n清爽不黏腻 · 妆前也服帖 · 夏日通勤首选',
    },
  ],
  hashtags: ['#夏日防晒', '#清爽护肤', '#通勤好物', '#防晒霜推荐', '#夏天也要白'],
  usedAssetIds: ['asset-01', 'asset-02', 'asset-09'],
  rationale: '基于 3 个素材的画面描述、标签与文本片段生成；未引入外部商品参数。',
}

const headphonesCopy: CopyResult = {
  headline: '把喧闹关在门外，把世界调成静音',
  tone: '克制、沉浸、科技感',
  variants: [
    {
      id: 'social',
      label: '小红书文案',
      content:
        '戴上耳机的那一刻，世界终于安静了。\n\n最近把桌面重新整理了一遍，只留下耳机、支架和一盏灯。头梁的包裹感很轻，长时间戴着写稿也不会压耳。\n\n不是逃离城市，是给自己留一段不被打扰的时间。',
    },
    {
      id: 'product',
      label: '商品介绍',
      content:
        '为长时间聆听而设计。\n\n轻量头梁搭配柔软耳罩，分散佩戴压力；深色哑光机身融入桌面与通勤场景。无论是专注工作还是夜晚听歌，都能获得稳定、沉浸的聆听体验。',
    },
    {
      id: 'ad',
      label: '广告短文案',
      content: '把喧闹关在门外。\n一副耳机，一段只属于自己的时间。',
    },
  ],
  hashtags: ['#头戴式耳机', '#桌面美学', '#数码好物', '#沉浸式听歌'],
  usedAssetIds: ['asset-06', 'asset-11'],
  rationale: '围绕耳机素材的深色桌面、极简科技感生成，强调佩戴与专注场景。',
}

const coffeeCopy: CopyResult = {
  headline: '一杯手冲，把早晨还给自己',
  tone: '温暖、慢节奏、生活化',
  variants: [
    {
      id: 'social',
      label: '小红书文案',
      content:
        '早起十分钟，给自己冲一杯咖啡。\n\n水流绕圈落下的时候，整个房间都是烘焙香。阳光刚好落在木桌上，蒸汽慢慢升起来，这一刻比闹钟更像新一天的开始。\n\n不必很赶，慢慢来就好。',
    },
    {
      id: 'product',
      label: '商品介绍',
      content:
        '让手冲变得简单，也让日常多一点仪式感。\n\n稳定的水流与合适的粉水比，带来干净、层次清晰的口感。玻璃壶身方便观察萃取过程，适合居家、办公室与周末早晨。',
    },
    {
      id: 'ad',
      label: '广告短文案',
      content: '把早晨还给自己。\n一杯手冲的时间，刚刚好。',
    },
  ],
  hashtags: ['#手冲咖啡', '#慢生活', '#早餐仪式感', '#咖啡日常'],
  usedAssetIds: ['asset-07', 'asset-08'],
  rationale: '基于手冲咖啡与奶油风家居素材，提炼温暖、慢节奏的生活方式表达。',
}

const genericCopy: CopyResult = {
  headline: '把灵感，变成下一次发布',
  tone: '简洁、有画面感',
  variants: [
    {
      id: 'social',
      label: '小红书文案',
      content:
        '有些灵感，藏在已经拍过的素材里。\n\n重新翻看之前的画面，才发现同一束光、同一个色调，换个角度就能讲出新的故事。\n\n这次不追热点，只把真正喜欢的画面整理出来。',
    },
    {
      id: 'product',
      label: '商品介绍',
      content:
        '从真实素材出发，让内容更有依据。\n\n围绕画面中的场景、材质与氛围，提炼清晰的产品卖点与使用场景，适合详情页、社交媒体与活动传播。',
    },
    {
      id: 'ad',
      label: '广告短文案',
      content: '好素材，自己会说话。\n从一张图，到一次完整的表达。',
    },
  ],
  hashtags: ['#内容创作', '#素材灵感', '#品牌表达'],
  usedAssetIds: [],
  rationale: '基于当前素材库中的高相关图片生成，建议补充具体商品信息后再发布。',
}

function pickCopy(query: string) {
  if (/防晒|护肤|清爽/.test(query)) return sunscreenCopy
  if (/耳机|数码|桌面/.test(query)) return headphonesCopy
  if (/咖啡|手冲|早餐/.test(query)) return coffeeCopy
  return genericCopy
}

function topicPhrase(query: string) {
  if (/防晒|护肤/.test(query)) return '夏季防晒'
  if (/耳机|数码/.test(query)) return '耳机新品'
  if (/咖啡/.test(query)) return '手冲咖啡'
  if (/母亲节|礼物/.test(query)) return '母亲节礼赠'
  if (/通勤|穿搭/.test(query)) return '通勤穿搭'
  if (/家居|客厅/.test(query)) return '家居场景'
  return '这次需求'
}

export function buildAgentOutcome(query: string, assets: Asset[]): AgentOutcome {
  const isAnalyze = /分析/.test(query)
  const isGenerate = /写|文案|介绍|标题|种草|生成/.test(query)
  const kind: AgentKind = isAnalyze ? 'analyze' : isGenerate ? 'generate' : 'search'
  const hits = searchAssets(query, assets)
  const fallback = assets.filter((asset) => asset.status === 'ready' && asset.fileType === 'image')
  const topicKeywords = /防晒|护肤/.test(query)
    ? ['防晒', '护肤', '海岛', '夏日', '清爽']
    : /耳机|数码/.test(query)
      ? ['耳机', '桌面', '科技', '数码']
      : /咖啡/.test(query)
        ? ['咖啡', '家居', '生活', '暖调']
        : /通勤|穿搭/.test(query)
          ? ['通勤', '街拍', '包', '模特']
          : /家居|客厅/.test(query)
            ? ['家居', '客厅', '软装', '奶油风']
            : ['夏日', '场景', '产品', '生活']
  const relevanceScore = (asset: Asset) => {
    const haystack = `${asset.name} ${asset.category} ${asset.tags.join(' ')} ${asset.summary}`
    return topicKeywords.reduce(
      (score, keyword) =>
        score + (haystack.includes(keyword) ? (asset.name.includes(keyword) ? 2 : 1) : 0),
      0,
    )
  }
  const relevant = fallback
    .filter((asset) => relevanceScore(asset) > 0)
    .sort((a, b) => relevanceScore(b) - relevanceScore(a))
  const fill = fallback.filter((asset) => !relevant.some((item) => item.id === asset.id))
  const selected = (
    hits.length ? hits.map((hit) => hit.asset) : [...relevant, ...fill]
  ).slice(0, 3)

  if (kind === 'search') {
    return {
      kind,
      text: `我找到了 ${selected.length} 个与「${topicPhrase(query)}」相关的素材，优先推荐 ${selected
        .map((asset) => asset.name)
        .slice(0, 2)
        .join('、')}。已经按相关性排序，并附上匹配理由。`,
      assetIds: selected.map((asset) => asset.id),
    }
  }

  if (kind === 'analyze') {
    return {
      kind,
      text:
        '我读取了当前可用的品牌与内容素材，先给出 3 个方向：\n\n1. 用「自然光 + 留白」承接夏季清爽感；\n2. 主视觉保留大面积文字安全区，适合叠加促销信息；\n3. 色彩以冷白为主，局部用暖橙做行动点。\n\n注意：品牌视觉规范 v3.2 仍处于解析失败状态，建议先重试解析后再生成正式规范。',
      assetIds: selected.map((asset) => asset.id),
    }
  }

  const copy = pickCopy(query)
  const matchedUsed = copy.usedAssetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is Asset => Boolean(asset))
  const used = matchedUsed.length ? matchedUsed : selected.slice(0, 3)

  return {
    kind,
    text: `我筛选了 ${used.length} 个最相关的素材，并生成了 3 个版本的文案。你可以切换「小红书 / 商品介绍 / 广告短文案」，也可以直接编辑后复制。`,
    assetIds: used.map((asset) => asset.id),
    copy: { ...copy, usedAssetIds: used.map((asset) => asset.id) },
  }
}

export const examplePrompts = [
  '为这款防晒霜找 3 张清爽场景图，并写一段小红书文案',
  '找一些适合母亲节礼物的暖色调素材',
  '分析品牌视觉规范并生成 618 主视觉建议',
]
