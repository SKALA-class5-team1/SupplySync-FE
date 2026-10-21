<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getTask, openTaskStream, type TaskEvent, type TaskState } from '../api/task'
import { getAnalysis } from '../api/rfq'
import { ApiError } from '../api/client'
import { isManager } from '../session'
import { errorMessage, label, STEP_LABEL, STEP_ORDER, TASK_LABEL } from '../labels'
import type { AnalysisResponse } from '../api/types'

const props = defineProps<{ taskId: string; rfq?: string }>()

const MAX_RECONNECT = 3
const TERMINAL_STATUS = ['DONE', 'FAILED']

const events = ref<TaskEvent[]>([])
const task = ref<TaskState | null>(null)
const activeStep = ref('')
const doneSteps = ref<string[]>([])
const analysis = ref<AnalysisResponse | null>(null)
const finished = ref(false)
const reconnects = ref(0)
const notice = ref('')
let stop: (() => void) | null = null

// 진행 표시줄: 실제로 들어온 단계만 보인다. 대안 분석은 부품이 부족할 때만 나온다.
const visibleSteps = computed(() => STEP_ORDER.filter((s) => s === activeStep.value || doneSteps.value.includes(s)))

// 사건 이벤트(요구 확인·승인 요청)의 상세는 SSE 본문에 없으므로 분석 결과를 다시 받는다
async function refreshAnalysis() {
  if (!isManager() || !props.rfq) return
  try {
    analysis.value = await getAnalysis(props.rfq)
  } catch (err) {
    notice.value = err instanceof ApiError ? errorMessage(err.code, '분석 결과를 불러오지 못했습니다.') : '분석 결과를 불러오지 못했습니다.'
  }
}

function stepOf(data: unknown): string {
  // 고객에게는 STEP_*의 단계와 시간만 온다. 필드명 step/name은 백엔드 확인 전 임시 가정.
  const d = data as { step?: string; name?: string } | null
  return d?.step ?? d?.name ?? ''
}

function onEvent(e: TaskEvent) {
  if (e.event === 'STEP_START') {
    activeStep.value = stepOf(e.data)
  } else if (e.event === 'STEP_END') {
    const s = stepOf(e.data)
    if (s && !doneSteps.value.includes(s)) doneSteps.value.push(s)
    if (activeStep.value === s) activeStep.value = ''
  } else if (e.event === 'CLARIFICATION_REQUIRED' || e.event === 'APPROVAL_REQUIRED') {
    refreshAnalysis()
  }
  if (e.event === 'DONE' || e.event === 'FAILED') finished.value = true
  // 고객 화면에는 내부 이벤트 내용을 쌓지 않는다
  if (isManager() || e.event === 'STEP_START' || e.event === 'STEP_END' || e.event === 'DONE' || e.event === 'FAILED') {
    events.value.push(e)
  }
}

function start() {
  stop = openTaskStream(props.taskId, {
    onEvent,
    onDisconnect: (reason) => {
      stop = null
      if (reason === 'terminal') {
        finished.value = true
        return
      }
      // 지난 이벤트는 다시 받을 수 없다. 상태를 먼저 확인하고, 끝나지 않았으면 다시 연결한다.
      recover()
    },
  })
}

async function recover() {
  try {
    task.value = await getTask(props.taskId)
    if (task.value.current_step) activeStep.value = task.value.current_step
    if (TERMINAL_STATUS.includes(task.value.status)) {
      finished.value = true
      return
    }
  } catch (err) {
    notice.value = err instanceof ApiError ? errorMessage(err.code, '작업 상태를 가져오지 못했습니다.') : '작업 상태를 가져오지 못했습니다.'
    return
  }
  if (reconnects.value >= MAX_RECONNECT) {
    notice.value = '연결을 여러 번 다시 시도했지만 실패했습니다. 새로고침해 주세요.'
    return
  }
  reconnects.value += 1
  start()
}

onMounted(async () => {
  try {
    task.value = await getTask(props.taskId)
    if (task.value.current_step) activeStep.value = task.value.current_step
    if (TERMINAL_STATUS.includes(task.value.status)) finished.value = true
  } catch (err) {
    notice.value = err instanceof ApiError ? errorMessage(err.code, '작업을 찾을 수 없습니다.') : '작업을 불러오지 못했습니다.'
    return
  }
  if (!finished.value) start()
})
onBeforeUnmount(() => stop?.())
</script>

<template>
  <section class="card">
    <div class="head">
      <div>
        <h1>검토 진행</h1>
        <p class="muted">작업 <span class="num">{{ taskId }}</span> · 상태 {{ label(TASK_LABEL, task?.status) }}</p>
      </div>
      <RouterLink v-if="rfq" :to="`/rfqs/${rfq}`">RFQ 보기</RouterLink>
    </div>

    <ol class="steps" aria-label="진행 단계">
      <li v-for="s in visibleSteps" :key="s" :class="{ done: doneSteps.includes(s), active: s === activeStep }">
        {{ STEP_LABEL[s] }}
      </li>
    </ol>

    <template v-if="isManager() && analysis">
      <div class="notice">
        <b>담당자 확인 항목</b>
        <pre class="json">{{ JSON.stringify(analysis.review, null, 2) }}</pre>
        <RouterLink v-if="rfq" :to="`/rfqs/${rfq}`">견적 승인 화면으로</RouterLink>
      </div>
    </template>

    <ol class="log">
      <li v-for="(e, i) in events" :key="i">
        <span class="tag">{{ e.event }}</span>
        <code>{{ typeof e.data === 'string' ? e.data : JSON.stringify(e.data) }}</code>
      </li>
      <li v-if="!events.length" class="muted">진행 이벤트를 기다리는 중입니다.</li>
    </ol>

    <p v-if="finished" class="muted">작업이 끝났습니다. 상태: {{ label(TASK_LABEL, task?.status ?? 'DONE') }}</p>
    <p v-if="notice" class="err" role="alert">{{ notice }}</p>
    <RouterLink to="/rfqs">RFQ 목록</RouterLink>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h1 { margin: 0; font-size: 22px; }
.muted { color: var(--muted); margin: 4px 0 0; font-size: 13px; }
.steps { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
.steps li { font-size: 12.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.steps li.done { color: var(--accent); border-color: var(--accent); }
.steps li.active { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.notice { border-left: 3px solid var(--accent); background: var(--bg); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.json { background: var(--surface); border-radius: 6px; padding: 8px; font-size: 12px; overflow-x: auto; margin: 0; }
.log { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.tag { display: inline-block; min-width: 170px; font-weight: 600; color: var(--accent); }
code { overflow-wrap: anywhere; }
.err { color: var(--err); margin: 0; }
</style>
