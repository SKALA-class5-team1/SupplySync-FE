<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createRfq } from '../api/rfq'
import { ApiError } from '../api/client'
import { errorMessage } from '../labels'
import { notify } from '../toast'

const router = useRouter()
const file = ref<File | null>(null)
const preview = ref('')
const rfqNumber = ref('')
const dragging = ref(false)
const submitting = ref(false)
const error = ref('')

const canSubmit = computed(() => !!file.value && rfqNumber.value.trim() !== '' && !submitting.value)

function pick(f: File | null) {
  error.value = ''
  if (!f) return
  if (!/\.md$/i.test(f.name)) {
    error.value = '.md 파일만 올릴 수 있습니다.'
    return
  }
  if (f.size > 2 * 1024 * 1024) {
    error.value = '2MB 이하 파일만 올릴 수 있습니다.'
    return
  }
  file.value = f
  const reader = new FileReader()
  reader.onload = () => {
    preview.value = String(reader.result ?? '').split('\n').filter((l) => l.trim()).slice(0, 8).join('\n')
  }
  reader.readAsText(f, 'utf-8')
  if (!rfqNumber.value) {
    const guess = f.name.replace(/\.md$/i, '').match(/[A-Z0-9]+(?:-[A-Z0-9]+)+/i)
    if (guess) rfqNumber.value = guess[0].toUpperCase()
  }
}

function onInput(e: Event) {
  pick((e.target as HTMLInputElement).files?.[0] ?? null)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  pick(e.dataTransfer?.files?.[0] ?? null)
}

async function submit() {
  if (!file.value || !canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await createRfq(file.value, rfqNumber.value.trim())
    notify('RFQ를 접수했습니다. 검토를 시작합니다.', 'ok')
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
  <div>
    <div class="page-head">
      <div>
        <h1>RFQ 등록</h1>
        <p>요청서(.md)를 올리면 Agent가 수량과 납기를 원문에서 추출하고 검토를 시작합니다.</p>
      </div>
    </div>

    <div class="grid2">
      <section class="card stack">
        <h2>1. 요청서 파일</h2>
        <label
          class="drop"
          :class="{ over: dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <input type="file" accept=".md" class="sr" @change="onInput" />
          <template v-if="file">
            <b>{{ file.name }}</b>
            <span>{{ (file.size / 1024).toFixed(1) }} KB · 다른 파일을 올리려면 다시 누르세요</span>
          </template>
          <template v-else>
            <b>요청서를 여기에 끌어다 놓으세요</b>
            <span>또는 눌러서 선택 · .md · 2MB 이하</span>
          </template>
        </label>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <div class="note-box">요청서 표(| 항목 | 값 |)에서 수량, 기간, 사양을 읽습니다. 값이 빠져도 접수는 되고, 확인 항목으로 표시됩니다.</div>
      </section>

      <section class="card stack">
        <div class="field">
          <label for="rfq-number">RFQ 번호</label>
          <input id="rfq-number" v-model="rfqNumber" class="input" placeholder="HB-EV7-EWP-001" />
          <span class="hint">파일 이름에서 찾으면 자동으로 채웁니다.</span>
        </div>
        <div>
          <h3 class="small muted" style="margin-bottom:8px">원문 미리보기 · 앞부분 8줄</h3>
          <pre v-if="preview" class="preview">{{ preview }}</pre>
          <div v-else class="empty">파일을 고르면 내용이 여기에 보입니다.</div>
        </div>
        <div class="notice">
          <b class="small">접수 후 흐름</b>
          <ol class="small muted" style="margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:3px">
            <li>요청서 분석과 사양 매칭</li>
            <li>재고 확인, 부족 시 대체안 비교</li>
            <li>고객 가정 확인과 견적 작성</li>
            <li>담당자 승인 후 고객에게 발송</li>
          </ol>
        </div>
        <button class="btn primary block" :disabled="!canSubmit" @click="submit">
          {{ submitting ? '접수 중…' : 'RFQ 접수하고 검토 시작' }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.drop.over { border-color: var(--accent); background: var(--accent-soft); }
</style>
