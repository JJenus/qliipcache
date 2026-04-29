import { create as createYoutubeDl } from 'youtube-dl-exec'
import { execSync } from 'child_process'

// ─── Smart Binary Detection ─
function getYoutubeDlInstance() {
  // Try multiple methods in order of preference
  
  // Method 1: Check if system yt-dlp is available (Termux, Linux with pip install)
  try {
    execSync('which yt-dlp', { stdio: 'pipe' })
    console.log('[SETUP] Using system yt-dlp from PATH')
    return createYoutubeDl('yt-dlp')
  } catch {
    console.log('[SETUP] System yt-dlp not found in PATH')
  }

  // Method 2: Try youtube-dl-exec's bundled binary (production Linux)
  try {
    // Let youtube-dl-exec use its own binary discovery
    console.log('[SETUP] Using youtube-dl-exec bundled binary')
    return createYoutubeDl() // No path = use default discovery
  } catch {
    console.log('[SETUP] Failed to use youtube-dl-exec default binary')
  }

  // Method 3: Check common Linux paths
  const commonPaths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/opt/bin/yt-dlp',
    './bin/yt-dlp',
    './node_modules/youtube-dl-exec/bin/yt-dlp'
  ]

  for (const binaryPath of commonPaths) {
    try {
      execSync(`test -f "${binaryPath}" && test -x "${binaryPath}"`, { stdio: 'pipe' })
      console.log(`[SETUP] Found yt-dlp at: ${binaryPath}`)
      return createYoutubeDl(binaryPath)
    } catch {
      // Continue to next path
    }
  }

  // Method 4: Last resort - download and use pip (for fresh Linux)
  try {
    console.log('[SETUP] Attempting to install yt-dlp via pip...')
    execSync('pip install yt-dlp', { stdio: 'pipe' })
    console.log('[SETUP] Successfully installed yt-dlp via pip')
    return createYoutubeDl('yt-dlp')
  } catch (pipError) {
    console.error('[SETUP] Failed to install yt-dlp via pip:', pipError)
  }

  throw new Error(
    'yt-dlp not found. Please install it:\n' +
    '  Termux: pkg install yt-dlp\n' +
    '  Ubuntu/Debian: sudo apt install yt-dlp\n' +
    '  Or: pip install yt-dlp'
  )
}

// Initialize once at startup
const youtubedl = getYoutubeDlInstance()

// ─── Logger ─────────
const logger = {
  info: (m: string, d?: any) =>
    console.log(`[${new Date().toISOString()}] [INFO] ${m}`, d ?? ""),
  warn: (m: string, d?: any) =>
    console.warn(`[${new Date().toISOString()}] [WARN] ${m}`, d ?? ""),
  error: (m: string, d?: any) =>
    console.error(`[${new Date().toISOString()}] [ERROR] ${m}`, d ?? ""),
  debug: (m: string, d?: any) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] ${m}`, d ?? "")
    }
  },
}

// ─── Types ─────────
interface VideoFormat {
  id: string
  label: string
  ext: string
  filesize: number | null
  url: string
  type: "video" | "audio"
  height: number
}

interface VideoResponse {
  platform: string
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  viewCount: number | null
  formats: VideoFormat[]
}

// ─── Platform Detection & Configuration ───────────────
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube'
  if (urlLower.includes('tiktok.com')) return 'tiktok'
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) return 'facebook'
  if (urlLower.includes('instagram.com')) return 'instagram'
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter'
  return 'unknown'
}

function cleanUrl(url: string, platform: string): string {
  try {
    const urlObj = new URL(url)
    
    switch (platform) {
      case 'tiktok':
        return `https://www.tiktok.com${urlObj.pathname}`
      
      case 'instagram':
        return `https://www.instagram.com${urlObj.pathname}`
      
      case 'facebook':
        if (urlObj.pathname.includes('/reel/')) {
          return `https://www.facebook.com${urlObj.pathname.split('?')[0]}`
        }
        return `https://www.facebook.com${urlObj.pathname}`
      
      case 'twitter':
        return `https://twitter.com${urlObj.pathname}`
      
      default:
        return url
    }
  } catch {
    return url
  }
}

function getPlatformOptions(platform: string): any {
  const baseOptions: any = {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
  }

  switch (platform) {
    case 'youtube':
      return {
        ...baseOptions,
        extractorArgs: 'youtube:player_client=android,ios',
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
          'Accept-Language: en-US,en;q=0.9',
        ]
      }

    case 'tiktok':
      return {
        ...baseOptions,
        extractorArgs: 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com;app_version=30.5.3;manifest_app_version=30.5.3',
        addHeader: [
          'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language: en-US,en;q=0.9',
          'Sec-Fetch-Dest: document',
          'Sec-Fetch-Mode: navigate',
          'Sec-Fetch-Site: none',
        ]
      }

    case 'facebook':
      return {
        ...baseOptions,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'Accept-Language: en-US,en;q=0.9',
          'Cookie: sb=placeholder; datr=placeholder;',
        ]
      }

    case 'instagram':
      return {
        ...baseOptions,
        addHeader: [
          'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language: en-US,en;q=0.9',
          'X-IG-App-ID: 936619743392459',
        ]
      }

    case 'twitter':
      return {
        ...baseOptions,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'Accept-Language: en-US,en;q=0.9',
          'Authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        ]
      }

    default:
      return {
        ...baseOptions,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        ]
      }
  }
}

// ─── Error mapping ─
function mapError(message: string, platform: string): string {
  const msg = message.toLowerCase()

  if (msg.includes("private")) return "This content is private."
  if (msg.includes("unavailable") || msg.includes("not found")) return "This content is unavailable or removed."
  if (msg.includes("copyright")) return "This content is restricted due to copyright."
  if (msg.includes("login") || msg.includes("sign in")) return "This content requires login and cannot be accessed."
  if (msg.includes("geo") || msg.includes("region")) return "This content is not available in your region."
  
  if (platform === 'tiktok' && msg.includes('403')) return "TikTok blocked the request. The video might be private or region-restricted."
  if (platform === 'instagram' && msg.includes('login')) return "Instagram requires login to view this content."
  if (platform === 'twitter' && msg.includes('403')) return "Twitter/X blocked the request. The content might be private."

  return "Unable to process this video. Please try another link."
}

// ─── Format optimizer ─────
function mapFormats(formats: any[]): VideoFormat[] {
  const seen = new Set<string>()
  return formats
    .filter((f) => f.url && (f.vcodec !== "none" || f.acodec !== "none"))
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .map((f) => {
      const label = f.height ? `${f.height}p` : f.format_note || f.format || "unknown"
      if (seen.has(label)) return null
      seen.add(label)
      return {
        id: String(f.format_id),
        label,
        ext: f.ext || "mp4",
        filesize: f.filesize || f.filesize_approx || null,
        url: f.url,
        type: f.vcodec === "none" ? "audio" : "video",
        height: f.height || 0,
      }
    })
    .filter(Boolean)
    .slice(0, 6) as VideoFormat[]
}

// ─── Core fetcher ─
async function fetchVideo(url: string): Promise<VideoResponse> {
  const platform = detectPlatform(url)
  const cleanVideoUrl = cleanUrl(url, platform)
  
  logger.info(`Processing ${platform} video`, { 
    original: url.substring(0, 100),
    cleaned: cleanVideoUrl 
  })

  try {
    const options = getPlatformOptions(platform)
    const data = await youtubedl(cleanVideoUrl, options)

    logger.debug("yt-dlp response received", {
      title: data.title,
      formats: data.formats?.length,
    })

    const formats = mapFormats(data.formats || [])

    if (!formats.length) {
      throw new Error("No downloadable formats found.")
    }

    return {
      platform: data.extractor || platform,
      title: data.title,
      thumbnail: data.thumbnail || null,
      duration: data.duration || null,
      uploader: data.uploader || null,
      viewCount: data.view_count || null,
      formats,
    }
  } catch (err: any) {
    logger.error(`Failed to fetch ${platform} video`, {
      error: err?.message || err,
      stderr: err?.stderr?.substring(0, 200),
    })
    throw new Error(mapError(err?.stderr || err?.message || "Failed to fetch video information", platform))
  }
}

// ─── Handler ──────
export default defineEventHandler(async (event) => {
  const start = Date.now()
  try {
    const body = await readBody(event)
    const url = body?.url?.trim()
    
    if (!url) {
      throw createError({
        statusCode: 400,
        message: "Please provide a valid URL.",
      })
    }

    // Basic URL validation
    const validDomains = ['youtube.com', 'youtu.be', 'tiktok.com', 'facebook.com', 'fb.watch', 'instagram.com', 'twitter.com', 'x.com']
    const isValidDomain = validDomains.some(domain => url.toLowerCase().includes(domain))
    
    if (!isValidDomain) {
      throw createError({
        statusCode: 400,
        message: "Unsupported URL. Please provide a link from YouTube, TikTok, Facebook, Instagram, or Twitter/X.",
      })
    }

    logger.info("Processing request", { url: url.substring(0, 100) })
    const result = await fetchVideo(url)
    
    logger.info("Success", {
      platform: result.platform,
      title: result.title,
      formats: result.formats.length,
      durationMs: Date.now() - start,
    })
    
    return result
  } catch (e: any) {
    const msg = e?.message || "Unexpected error"
    
    logger.error("Request failed", {
      error: msg,
      durationMs: Date.now() - start,
    })

    throw createError({
      statusCode: e.statusCode || 500,
      message: msg,
    })
  }
})