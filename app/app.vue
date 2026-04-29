<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
<script setup lang="ts">
// ── Eruda mobile console (only when ?eruda=1 in URL) ──────────────────────────
if (import.meta.client) {
  const url = new URL(window.location.href)

  const shouldLoadEruda =
    import.meta.dev || url.searchParams.get('eruda') === '1'

  if (shouldLoadEruda && !(window as any).eruda) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => { (window as any).eruda.init() }
    document.head.appendChild(script)
  }
}

</script>