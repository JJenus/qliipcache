import ytdl from '@distube/ytdl-core'

// ─── Platform detection ────────────────────────────────────────────────────

const PLATFORMS = {
  youtube: /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)/i,
  instagram: /instagram\.com\/(?:p|reel|tv)\//i,
  facebook: /(?:facebook\.com|fb\.watch)\/(?:watch|video|reel|\d)/i,
  twitter: /(?:twitter\.com|x\.com)\/\w+\/status\//i,
  tiktok: /(?:tiktok\.com\/@[\w.]+\/video\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/)/i,
} as const

type Platform = keyof typeof PLATFORMS

function detectPlatform(url: string): Platform | null {
  for (const [platform, regex] of Object.entries(PLATFORMS)) {
    if (regex.test(url)) return platform as Platform
  }
  return null
}

// ─── Response shape ────────────────────────────────────────────────────────

interface VideoFormat {
  id: string
  label: string
  ext: string
  filesize: number | null
  url: string
  type: 'video' | 'audio'
  height: number
}

interface VideoResponse {
  platform: Platform
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  viewCount: number | null
  formats: VideoFormat[]
}

// ─── YouTube (via @distube/ytdl-core) ─────────────────────────────────────

async function fetchYouTube(url: string): Promise<VideoResponse> {
  const info = await ytdl.getInfo(url)
  const { videoDetails } = info

  const seen = new Set<string>()
  const formats: VideoFormat[] = []

  // Combined video+audio formats, sorted by resolution descending
  const videoFormats = info.formats
    .filter(f => f.hasVideo && f.hasAudio && f.url)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))

  for (const f of videoFormats) {
    const label = f.height ? `${f.height}p` : (f.qualityLabel ?? f.quality)
    if (seen.has(label)) continue
    seen.add(label)
    formats.push({
      id: f.itag.toString(),
      label,
      ext: f.container ?? 'mp4',
      filesize: f.contentLength ? Number(f.contentLength) : null,
      url: f.url,
      type: 'video',
      height: f.height ?? 0,
    })
    if (formats.length >= 5) break
  }

  // Best audio-only
  const audioFormats = info.formats
    .filter(f => !f.hasVideo && f.hasAudio && f.url)
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0))

  if (audioFormats.length > 0) {
    const a = audioFormats[0]
    formats.push({
      id: a.itag.toString(),
      label: `Audio ${a.audioBitrate ? Math.round(a.audioBitrate) + 'kbps' : 'only'}`,
      ext: a.container ?? 'm4a',
      filesize: a.contentLength ? Number(a.contentLength) : null,
      url: a.url,
      type: 'audio',
      height: 0,
    })
  }

  return {
    platform: 'youtube',
    title: videoDetails.title,
    thumbnail: videoDetails.thumbnails.at(-1)?.url ?? null,
    duration: Number(videoDetails.lengthSeconds) || null,
    uploader: videoDetails.author.name ?? null,
    viewCount: Number(videoDetails.viewCount) || null,
    formats,
  }
}

// ─── TikTok (via @mrnima/tiktok-downloader) ───────────────────────────────

async function fetchTikTok(url: string): Promise<VideoResponse> {
  // Dynamic import — package uses CJS default export
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const downloader = await import('@mrnima/tiktok-downloader')
  const dl = downloader.default ?? downloader

  // The package accepts a TikTok URL and returns media data
  const result = await dl.Tiktok(url)

  if (!result || result.status !== 'success') {
    throw new Error('Could not fetch TikTok video. The video may be private or unavailable.')
  }

  const data = result.result
  const formats: VideoFormat[] = []

  // No-watermark video (preferred)
  if (data?.video?.nowm) {
    formats.push({
      id: 'nowm',
      label: 'No Watermark',
      ext: 'mp4',
      filesize: null,
      url: data.video.nowm,
      type: 'video',
      height: 0,
    })
  }

  // With-watermark video (fallback)
  if (data?.video?.wm) {
    formats.push({
      id: 'wm',
      label: 'With Watermark',
      ext: 'mp4',
      filesize: null,
      url: data.video.wm,
      type: 'video',
      height: 0,
    })
  }

  // Audio
  if (data?.music) {
    formats.push({
      id: 'audio',
      label: 'Audio',
      ext: 'mp3',
      filesize: null,
      url: data.music,
      type: 'audio',
      height: 0,
    })
  }

  return {
    platform: 'tiktok',
    title: data?.title ?? 'TikTok Video',
    thumbnail: data?.thumbnail ?? null,
    duration: null,
    uploader: data?.author?.nickname ?? null,
    viewCount: null,
    formats,
  }
}

// ─── Instagram / Facebook / X/Twitter (via Cobalt API) ───────────────────
//
//   Cobalt is a free, open-source, no-key-required video download API.
//   Docs: https://cobalt.tools / https://github.com/imputnet/cobalt
//   Instance used: api.cobalt.tools  (official public instance)
//

async function fetchViaCobalt(
  url: string,
  platform: 'instagram' | 'facebook' | 'twitter',
): Promise<VideoResponse> {
  // Step 1: Ask Cobalt for the download stream/URL
  const cobaltRes = await $fetch<{
    status: string
    url?: string
    urls?: string[]
    filename?: string
    error?: { code: string; context?: Record<string, unknown> }
    picker?: Array<{ type: string; url: string; thumb?: string }>
  }>('https://api.cobalt.tools/', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: {
      url,
      videoQuality: '1080',
      audioFormat: 'mp3',
      filenameStyle: 'pretty',
    },
  })

  if (cobaltRes.status === 'error') {
    const code = cobaltRes.error?.code ?? 'unknown'
    if (code.includes('content.unavailable') || code.includes('fetch.fail')) {
      throw new Error('This video is unavailable, private, or region-locked.')
    }
    if (code.includes('link.unsupported')) {
      throw new Error('This URL is not supported.')
    }
    throw new Error(`Could not fetch video (${code}).`)
  }

  const formats: VideoFormat[] = []

  // Cobalt returns either a single `url` or a `picker` array (for multi-item posts)
  if (cobaltRes.status === 'stream' || cobaltRes.status === 'redirect') {
    if (cobaltRes.url) {
      formats.push({
        id: 'best',
        label: 'Best Quality',
        ext: 'mp4',
        filesize: null,
        url: cobaltRes.url,
        type: 'video',
        height: 0,
      })
    }
  }
  else if (cobaltRes.status === 'picker' && cobaltRes.picker) {
    cobaltRes.picker.forEach((item, idx) => {
      formats.push({
        id: `pick-${idx}`,
        label: item.type === 'video' ? `Video ${idx + 1}` : `Image ${idx + 1}`,
        ext: item.type === 'video' ? 'mp4' : 'jpg',
        filesize: null,
        url: item.url,
        type: 'video',
        height: 0,
      })
    })
  }

  // Cobalt doesn't return metadata — build a minimal but clean response
  const platformLabels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X / Twitter',
  }

  return {
    platform,
    title: `${platformLabels[platform]} Video`,
    thumbnail: cobaltRes.picker?.[0]?.thumb ?? null,
    duration: null,
    uploader: null,
    viewCount: null,
    formats,
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'URL is required.' })
  }

  const trimmed = url.trim()
  const platform = detectPlatform(trimmed)

  if (!platform) {
    throw createError({
      statusCode: 400,
      message: 'Unsupported platform. Paste a YouTube, TikTok, Instagram, Facebook, or X/Twitter link.',
    })
  }

  try {
    switch (platform) {
      case 'youtube':
        return await fetchYouTube(trimmed)

      case 'tiktok':
        return await fetchTikTok(trimmed)

      case 'instagram':
      case 'facebook':
      case 'twitter':
        return await fetchViaCobalt(trimmed, platform)
    }
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)

    // Surface known user-facing messages directly
    if (
      msg.includes('private')
      || msg.includes('unavailable')
      || msg.includes('region-locked')
      || msg.includes('not supported')
      || msg.includes('login')
      || msg.includes('Sign in')
    ) {
      throw createError({ statusCode: 403, message: msg })
    }

    // Unexpected errors — give a generic but clean message
    console.error(`[QliipCache] ${platform} fetch error:`, msg)
    throw createError({
      statusCode: 500,
      message: 'Could not fetch video info. The video may be private, region-locked, or the URL may be invalid.',
    })
  }
})