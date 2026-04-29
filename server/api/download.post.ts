import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const SUPPORTED_PLATFORMS = {
  youtube: /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)/i,
  instagram: /instagram\.com\/(?:p|reel|tv)\//i,
  facebook: /(?:facebook\.com|fb\.watch)\/(?:watch|video|reel|\d)/i,
  twitter: /(?:twitter\.com|x\.com)\/\w+\/status\//i,
}

function detectPlatform(url: string): string | null {
  for (const [platform, regex] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (regex.test(url)) return platform
  }
  return null
}

async function getYtDlpPath(): Promise<string> {
  const paths = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp']
  for (const p of paths) {
    try {
      await execFileAsync(p, ['--version'])
      return p
    } catch {}
  }
  throw new Error('yt-dlp not found. Please install it: https://github.com/yt-dlp/yt-dlp')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'URL is required' })
  }

  const platform = detectPlatform(url.trim())
  if (!platform) {
    throw createError({
      statusCode: 400,
      message: 'Unsupported platform. Paste a YouTube, Instagram, Facebook, or X/Twitter link.',
    })
  }

  let ytDlpBin: string
  try {
    ytDlpBin = await getYtDlpPath()
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e.message })
  }

  try {
    // Fetch video metadata as JSON
    const { stdout } = await execFileAsync(ytDlpBin, [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url.trim(),
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })

    const info = JSON.parse(stdout.trim())

    // Collect available formats
    const formats: any[] = []

    if (info.formats) {
      // Group by quality
      const seen = new Set<string>()

      // Video + Audio combined formats
      const videoFormats = info.formats
        .filter((f: any) => f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
        .sort((a: any, b: any) => (b.height || 0) - (a.height || 0))

      for (const f of videoFormats) {
        const label = f.height ? `${f.height}p` : f.format_note || f.format_id
        if (seen.has(label)) continue
        seen.add(label)
        formats.push({
          id: f.format_id,
          label,
          ext: f.ext || 'mp4',
          filesize: f.filesize || f.filesize_approx || null,
          url: f.url,
          type: 'video',
          height: f.height || 0,
        })
        if (formats.length >= 5) break
      }

      // Audio only
      const audioFormats = info.formats
        .filter((f: any) => f.vcodec === 'none' && f.acodec !== 'none' && f.url)
        .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0))

      if (audioFormats.length > 0) {
        const a = audioFormats[0]
        formats.push({
          id: a.format_id,
          label: `Audio ${a.abr ? Math.round(a.abr) + 'kbps' : 'only'}`,
          ext: a.ext || 'mp3',
          filesize: a.filesize || a.filesize_approx || null,
          url: a.url,
          type: 'audio',
          height: 0,
        })
      }
    }

    // Fallback: use the best direct URL if no granular formats
    if (formats.length === 0 && info.url) {
      formats.push({
        id: 'best',
        label: 'Best Quality',
        ext: info.ext || 'mp4',
        filesize: null,
        url: info.url,
        type: 'video',
        height: info.height || 0,
      })
    }

    return {
      platform,
      title: info.title || 'Video',
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      uploader: info.uploader || info.channel || null,
      viewCount: info.view_count || null,
      formats,
    }
  } catch (e: any) {
    const msg = e.message || ''
    if (msg.includes('Private video') || msg.includes('not available')) {
      throw createError({ statusCode: 403, message: 'This video is private or unavailable.' })
    }
    if (msg.includes('Sign in') || msg.includes('login')) {
      throw createError({ statusCode: 403, message: 'This video requires login to access.' })
    }
    throw createError({
      statusCode: 500,
      message: 'Could not fetch video info. The video may be private, region-locked, or the URL may be invalid.',
    })
  }
})
