<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createRfq } from '../api/rfq'
import { ApiError } from '../api/client'
import { errorMessage } from '../labels'

const router = useRouter()
const file = ref<File | null>(null)
const rfqNumber = ref('')
const submitting = ref(false)
const error = ref('')

const canSubmit = computed(() => !!file.value && rfqNumber.value.trim() !== '' && !submitting.value)

// 요청서는 .md 파일만 받는다 (명세: file(.md))
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (f && !/\.md$/i.test(f.name)) {
    error.value = '.md 파일만 올릴 수 있습니다.'
    file.value = null
    return
  }
  file.value = f
}

async function submit() {
  if (!file.value || !canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await createRfq(file.value, rfqNumber.value.trim())
    await router.push(`/tasks/${res.task_id}?rfq=${encodeURIComponent(res.rfq_id)}`)
  } catch (err) {
    error.value = err instanceof ApiError
      ? errorMessage(err.code, '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      : '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="card">
    <h1>RFQ 등록</h1>
    <p class="muted">요청서(.md)를 올리면 수량·납기는 Agent가 원문에서 추출합니다.</p>
    <form class="stack" @submit.prevent="submit">
      <label class="drop">
        <b>{{ file ? file.name : '요청서 .md 파일 선택' }}</b>
        <input type="file" accept=".md" class="sr" @change="onFile" />
      </label>
      <label class="field">RFQ 번호<input v-model="rfqNumber" placeholder="HB-EV7-EWP-001" required /></label>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <button class="btn" :disabled="!canSubmit">{{ submitting ? '접수 중…' : 'RFQ 접수' }}</button>
    </form>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
h1 { margin: 0 0 6px; font-size: 22px; }
.muted { color: var(--muted); margin: 0 0 12px; font-size: 13px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.drop { border: 1.5px dashed var(--muted); border-radius: 10px; padding: 18px; text-align: center; cursor: pointer; }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
input { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 9px 11px; font: inherit; }
.btn { align-self: flex-start; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.err { color: var(--err); margin: 0; }
</style>
