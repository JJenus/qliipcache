<script setup lang="ts">
useHead({
  title: 'QliipCache - Social Video Downloader',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
    },
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes' },
  ],
})

interface VideoFormat {
  id: string
  label: string
  ext: string
  filesize: number | null
  url: string
  type: 'video' | 'audio'
  height: number
}

interface VideoInfo {
  platform: string
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  viewCount: number | null
  formats: VideoFormat[]
}

const url = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const videoInfo = ref<VideoInfo | null>(null)
const downloadingId = ref<string | null>(null)

const platformConfig: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  youtube: { icon: 'i-simple-icons-youtube', color: '#FF0000', label: 'YouTube', bg: 'rgba(255,0,0,0.12)' },
  instagram: { icon: 'i-simple-icons-instagram', color: '#E1306C', label: 'Instagram', bg: 'rgba(225,48,108,0.12)' },
  facebook: { icon: 'i-simple-icons-facebook', color: '#1877F2', label: 'Facebook', bg: 'rgba(24,119,242,0.12)' },
  twitter: { icon: 'i-simple-icons-x', color: '#ffffff', label: 'X / Twitter', bg: 'rgba(255,255,255,0.08)' },
}

const supportedPlatforms = [
  { key: 'youtube', icon: 'i-simple-icons-youtube', color: '#FF0000', label: 'YouTube' },
  { key: 'instagram', icon: 'i-simple-icons-instagram', color: '#E1306C', label: 'Instagram' },
  { key: 'facebook', icon: 'i-simple-icons-facebook', color: '#1877F2', label: 'Facebook' },
  { key: 'twitter', icon: 'i-simple-icons-x', color: '#ffffff', label: 'X / Twitter' },
]

const detectedPlatform = computed(() => {
  const v = url.value
  if (/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)/i.test(v)) return 'youtube'
  if (/instagram\.com\/(?:p|reel|tv)\//i.test(v)) return 'instagram'
  if (/(?:facebook\.com|fb\.watch)\/(?:watch|video|reel|\d)/i.test(v)) return 'facebook'
  if (/(?:twitter\.com|x\.com)\/\w+\/status\//i.test(v)) return 'twitter'
  return null
})

const currentPlatform = computed(() =>
  videoInfo.value ? platformConfig[videoInfo.value.platform] : null
)

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`
  return `${count} views`
}

function formatFilesize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

async function fetchVideo(): Promise<void> {
  if (!url.value.trim()) return

  loading.value = true
  error.value = null
  videoInfo.value = null

  try {
    const data = await $fetch<VideoInfo>('/api/download', {
      method: 'POST',
      body: { url: url.value.trim() },
    })
    videoInfo.value = data
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

async function downloadFormat(format: VideoFormat): Promise<void> {
  downloadingId.value = format.id

  try {
    window.open(format.url, '_blank')
  } finally {
    setTimeout(() => {
      downloadingId.value = null
    }, 1500)
  }
}

function reset(): void {
  url.value = ''
  videoInfo.value = null
  error.value = null
}

function pasteFromClipboard(): void {
  navigator.clipboard.readText()
    .then(text => {
      if (text) url.value = text
    })
    .catch(() => {})
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    fetchVideo()
  }
}
</script>

<template>
  <div class="min-h-screen w-full overflow-x-hidden bg-[#080810] font-['DM_Sans'] text-slate-200">
    <!-- Ambient background effect -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute rounded-full blur-3xl opacity-20 -top-[200px] left-1/2 -translate-x-1/2 bg-gradient-radial from-cyan-400 to-transparent w-[min(600px,100vw)] h-[min(600px,100vw)]" />
      <div class="absolute rounded-full blur-3xl opacity-10 bottom-[100px] -right-[100px] bg-gradient-radial from-violet-600 to-transparent w-[min(400px,80vw)] h-[min(400px,80vw)]" />
    </div>

    <!-- Grid texture overlay -->
    <div class="fixed inset-0 pointer-events-none opacity-[0.03] bg-grid-pattern" />

    <div class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-20">
      <!-- Header -->
      <div class="text-center mb-8 sm:mb-12">
        <div class="inline-flex items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 tracking-wider">
          <span class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-current animate-pulse" />
          FREE · NO WATERMARKS · NO SIGNUP
        </div>

        <h1 class="text-5xl sm:text-7xl md:text-8xl mb-2 sm:mb-3 leading-none tracking-wider px-2 font-['Bebas_Neue'] bg-gradient-to-r from-white via-cyan-400 to-cyan-600 bg-clip-text text-transparent">
          QliipCache
        </h1>
        <p class="text-sm sm:text-base px-4 text-slate-500 font-light tracking-wide">
          Paste any video link, get it downloaded in seconds
        </p>
      </div>

      <!-- Supported Platforms -->
      <div class="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 px-2">
        <div
          v-for="platform in supportedPlatforms"
          :key="platform.key"
          class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all"
          :class="[
            detectedPlatform === platform.key ? 'scale-105' : 'opacity-50',
            detectedPlatform === platform.key ? `shadow-sm` : ''
          ]"
          :style="{
            background: detectedPlatform === platform.key ? `${platform.color}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${detectedPlatform === platform.key ? `${platform.color}55` : 'rgba(255,255,255,0.08)'}`,
            color: detectedPlatform === platform.key ? platform.color : '#94a3b8',
          }"
        >
          <UIcon :name="platform.icon" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span class="hidden xs:inline">{{ platform.label }}</span>
          <span class="xs:hidden">{{ platform.key.charAt(0).toUpperCase() }}</span>
        </div>
      </div>

      <!-- Main Input Card -->
      <div class="rounded-2xl p-[1px] mb-6 mx-2 sm:mx-0 bg-gradient-to-br from-cyan-400/20 to-violet-600/20 shadow-[0_0_0_1px_rgba(0,229,255,0.12)] shadow-2xl">
        <div class="rounded-xl p-4 sm:p-6 bg-[#0e0e1a]">
          <label class="block text-[10px] sm:text-xs font-mono mb-2 sm:mb-3 text-cyan-400 tracking-wider">
            PASTE VIDEO URL
          </label>

          <!-- Input group - column on mobile, row on tablet+ -->
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div class="relative flex-1">
              <input
                v-model="url"
                type="url"
                placeholder="https://youtube.com/watch?v=... or instagram.com/reel/..."
                class="w-full rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none transition-all bg-white/5 border border-white/10 text-slate-200 font-['JetBrains_Mono'] placeholder:text-slate-700 focus:border-cyan-400/40"
                :class="url ? 'pr-20 sm:pr-24' : 'pr-20 sm:pr-24'"
                :style="url ? { borderColor: 'rgba(0, 229, 255, 0.3)' } : {}"
                @keydown="handleKeydown"
              />
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-mono transition-all hover:opacity-100 whitespace-nowrap text-cyan-400 opacity-50 bg-cyan-400/10 border border-cyan-400/20"
                @click="pasteFromClipboard"
              >
                PASTE
              </button>
            </div>

            <button
              :disabled="loading || !url.trim()"
              class="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 w-full sm:w-auto bg-gradient-to-r from-cyan-400 to-cyan-600 text-[#080810] shadow-lg hover:shadow-cyan-400/40 disabled:shadow-none"
              @click="fetchVideo"
            >
              <span v-if="loading" class="flex items-center gap-2 justify-center">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching
              </span>
              <span v-else>Fetch</span>
            </button>
          </div>

          <!-- URL examples -->
          <div v-if="!url" class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="example in [
                { label: 'YouTube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
                { label: 'Shorts', url: 'https://youtube.com/shorts/...' },
              ]"
              :key="example.label"
              class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-all hover:opacity-100 opacity-40 whitespace-nowrap bg-white/5 border border-white/10 text-slate-400 font-['JetBrains_Mono']"
              @click="url = example.url"
            >
              {{ example.label }} example
            </button>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <Transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div
          v-if="error"
          class="rounded-xl p-3 sm:p-4 mb-6 flex items-start gap-2 sm:gap-3 mx-2 sm:mx-0 bg-red-500/10 border border-red-500/25"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div class="flex-1">
            <p class="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 text-red-300">Error</p>
            <p class="text-xs sm:text-sm text-slate-400">{{ error }}</p>
          </div>
          <button class="ml-auto opacity-50 hover:opacity-100 flex-shrink-0" @click="error = null">
            <UIcon name="i-heroicons-x-mark" class="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </Transition>

      <!-- Video Result Card -->
      <Transition
        enter-active-class="transition-all duration-400"
        enter-from-class="opacity-0 translate-y-4 scale-98"
        enter-to-class="opacity-100 translate-y-0 scale-100"
      >
        <div
          v-if="videoInfo"
          class="rounded-2xl overflow-hidden mx-2 sm:mx-0 bg-[#0e0e1a] border border-cyan-400/15 shadow-2xl"
        >
          <!-- Platform badge + reset -->
          <div class="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 flex-wrap gap-2 border-b border-white/5">
            <div class="flex items-center gap-2">
              <div
                class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium"
                :style="{
                  background: currentPlatform?.bg,
                  border: `1px solid ${currentPlatform?.color}33`,
                  color: currentPlatform?.color,
                }"
              >
                <UIcon v-if="currentPlatform" :name="currentPlatform.icon" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {{ currentPlatform?.label }}
              </div>
              <span class="text-[10px] sm:text-xs font-mono hidden sm:inline text-slate-700">DETECTED</span>
            </div>
            <button
              class="text-[10px] sm:text-xs font-mono transition-all hover:opacity-100 opacity-40 flex items-center gap-1 text-slate-400"
              @click="reset"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              NEW SEARCH
            </button>
          </div>

          <!-- Thumbnail + Info -->
          <div class="p-3 sm:p-5">
            <!-- Stack on mobile, row on tablet+ -->
            <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-5">
              <!-- Thumbnail -->
              <div
                v-if="videoInfo.thumbnail"
                class="rounded-xl overflow-hidden w-full sm:w-[140px] h-[180px] sm:h-[90px] bg-slate-800"
              >
                <img :src="videoInfo.thumbnail" :alt="videoInfo.title" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="rounded-xl flex items-center justify-center w-full sm:w-[140px] h-[180px] sm:h-[90px] bg-slate-800 border border-white/5"
              >
                <UIcon name="i-heroicons-film" class="w-10 h-10 sm:w-8 sm:h-8 text-slate-700" />
              </div>

              <!-- Meta -->
              <div class="flex-1 min-w-0">
                <h2 class="text-sm sm:text-base font-semibold mb-2 leading-tight line-clamp-2 text-slate-100">
                  {{ videoInfo.title }}
                </h2>
                <div class="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono text-slate-500">
                  <span v-if="videoInfo.uploader" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-user-circle" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span class="truncate max-w-[100px] sm:max-w-none">{{ videoInfo.uploader }}</span>
                  </span>
                  <span v-if="videoInfo.duration" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-clock" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {{ formatDuration(videoInfo.duration) }}
                  </span>
                  <span v-if="videoInfo.viewCount" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {{ formatViews(videoInfo.viewCount) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Formats -->
            <div>
              <div class="text-[10px] sm:text-xs font-mono mb-2 sm:mb-3 text-cyan-400 tracking-wider">
                AVAILABLE FORMATS ({{ videoInfo.formats.length }})
              </div>

              <div v-if="videoInfo.formats.length === 0" class="text-xs sm:text-sm text-center py-4 sm:py-6 text-slate-500">
                No downloadable formats found for this video.
              </div>

              <div class="grid gap-2">
                <div
                  v-for="format in videoInfo.formats"
                  :key="format.id"
                  class="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl px-3 sm:px-4 py-3 transition-all group gap-3 sm:gap-2 bg-white/5 border border-white/5 hover:border-cyan-400/20 cursor-pointer"
                >
                  <div class="flex items-center gap-3 w-full sm:w-auto">
                    <!-- Format type icon -->
                    <div
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :class="format.type === 'video' ? 'bg-cyan-400/10 border-cyan-400/20' : 'bg-violet-500/10 border-violet-500/20'"
                      :style="{ border: `1px solid ${format.type === 'video' ? 'rgba(0, 229, 255, 0.2)' : 'rgba(139, 92, 246, 0.2)'}` }"
                    >
                      <UIcon
                        :name="format.type === 'video' ? 'i-heroicons-video-camera' : 'i-heroicons-musical-note'"
                        class="w-3.5 h-3.5 sm:w-4 sm:h-4"
                        :class="format.type === 'video' ? 'text-cyan-400' : 'text-violet-400'"
                      />
                    </div>

                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs sm:text-sm font-semibold text-slate-200">{{ format.label }}</span>
                        <span class="text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded font-mono uppercase bg-white/5 text-slate-500">
                          .{{ format.ext }}
                        </span>
                      </div>
                      <div v-if="formatFilesize(format.filesize)" class="text-[10px] sm:text-xs mt-0.5 font-mono text-slate-600">
                        {{ formatFilesize(format.filesize) }}
                      </div>
                    </div>
                  </div>

                  <button
                    :disabled="downloadingId !== null"
                    class="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 w-full sm:w-auto justify-center"
                    :class="downloadingId === format.id ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30' : 'bg-gradient-to-r from-cyan-400 to-cyan-600 text-[#080810] shadow-md hover:shadow-cyan-400/30'"
                    @click="downloadFormat(format)"
                  >
                    <svg
                      v-if="downloadingId === format.id"
                      class="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <UIcon v-else name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {{ downloadingId === format.id ? 'Opening...' : 'Download' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- How it works -->
      <div v-if="!videoInfo" class="mt-10 sm:mt-14 px-2 sm:px-0">
        <p class="text-center text-[10px] sm:text-xs font-mono mb-4 sm:mb-6 text-slate-700 tracking-wider">
          HOW IT WORKS
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div
            v-for="step in [
              { icon: 'i-heroicons-clipboard-document', title: 'Paste URL', desc: 'Copy any video link from YouTube, Instagram, Facebook, or X' },
              { icon: 'i-heroicons-magnifying-glass', title: 'Fetch Info', desc: 'We detect the platform and fetch all available quality options' },
              { icon: 'i-heroicons-arrow-down-tray', title: 'Download', desc: 'Choose your preferred quality and download instantly' },
            ]"
            :key="step.title"
            class="rounded-xl p-3 sm:p-4 text-center bg-white/5 border border-white/5"
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 bg-cyan-400/10 border border-cyan-400/15">
              <UIcon :name="step.icon" class="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            </div>
            <div class="text-xs sm:text-sm font-semibold mb-1 text-slate-200">{{ step.title }}</div>
            <div class="text-[10px] sm:text-xs leading-relaxed text-slate-600">{{ step.desc }}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-10 sm:mt-14 text-center px-2">
        <p class="text-[9px] sm:text-xs font-mono text-slate-800 tracking-wider">
          POWERED BY YT-DLP &nbsp;·&nbsp; FOR PERSONAL USE ONLY &nbsp;·&nbsp; RESPECT COPYRIGHT LAWS
        </p>
      </div>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  overflow-x: hidden;
}

/* Custom utilities */
@layer utilities {
  .bg-gradient-radial {
    background-image: radial-gradient(var(--tw-gradient-stops));
  }

  .bg-grid-pattern {
    background-image:
      linear-gradient(#00e5ff 1px, transparent 1px),
      linear-gradient(90deg, #00e5ff 1px, transparent 1px);
    background-size: 60px 60px;
  }
}

/* Custom breakpoint for extra small screens */
@media (min-width: 480px) {
  .xs\:inline {
    display: inline;
  }
  .xs\:hidden {
    display: none;
  }
}

.xs\:inline {
  display: none;
}

.xs\:hidden {
  display: inline;
}

@media (min-width: 480px) {
  .xs\:inline {
    display: inline;
  }
  .xs\:hidden {
    display: none;
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scale-98 {
  transform: scale(0.98);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}
</style>