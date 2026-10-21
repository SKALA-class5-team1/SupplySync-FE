<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getTask, openTaskStream, type TaskEvent, type TaskState } from '../api/task'
import { getAnalysis } from '../api/rfq'
import { submitConfirmation } from '../api/ai'
import ApprovalActions from '../components/ApprovalActions.vue'
import AnalysisPanel from '../components/AnalysisPanel.vue'
import { ApiError } from '../api/client'
import { isManager } from '../session'
import { errorMessage, label, OUTCOME_LABEL, STEP_LABEL, STEP_ORDER, TASK_LABEL } from '../labels'
import type { AnalysisResponse } from '../api/types'

const props = defineProps<{ taskId: string; rfq?: string }>()

const MAX_RECONNECT = 3
const TERMINAL_STATUS = ['DONE', 'FAILED', 'ON_HOLD']

const events = ref<TaskEvent[]>([])
const task = ref<TaskState | null>(null)
const activeStep = ref('')
const doneSteps = ref<string[]>([])
const analysis = ref<AnalysisResponse | null>(null)
const finished = ref(false)
const reconnects = ref(0)
const notice = ref('')
// 종료 정보: DONE의 outcome(REGISTERED/REJECTED), RUN_ON_HOLD·FAILED의 사유(사유는 담당자에게만 온다)
const doneOutcome = ref('')
const stopReason = ref('')
const stopped = ref('') // 'DONE' | 'FAILED' | 'ON_HOLD'
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

// 요구 확인(CLARIFICATION): 분석 결과의 가정값(assumptions: {field, value})을 담당자가 확인·수정한다.
// review 내부 필드명은 백엔드 스키마 확인 전 임시 가정이다.
interface Assumption { field: string; value: string }
const assumptionInputs = ref<Assumption[]>([])
const confirming = ref(false)

function fillAssumptions() {
  const raw = analysis.value?.review?.assumptions
  assumptionInputs.value = Array.isArray(raw)
    ? raw
        .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null && 'field' in a)
        .map((a) => ({ field: String(a.field), value: String(a.value ?? '') }))
    : []
}

const draftQuotes = computed(() =>
  isManager() && !finished.value && task.value?.status === 'WAITING_APPROVAL'
    ? (analysis.value?.quotes ?? []).filter((q) => q.status === 'DRAFT')
    : [],
)

// 승인·수정 요청을 접수한 뒤: 상태와 분석 결과를 다시 받는다
async function onDecided() {
  try {
    task.value = await getTask(props.taskId)
    await refreshAnalysis()
  } catch {
    // 진행 이벤트가 이어서 상태를 갱신한다
  }
}

const needsClarification = computed(() => isManager() && task.value?.status === 'NEEDS_CLARIFICATION' && !finished.value)

async function confirmAssumptions() {
  confirming.value = true
  notice.value = ''
  try {
    await submitConfirmation(props.taskId, assumptionInputs.value)
    notice.value = '요구 확인을 접수했습니다. 검토가 이어집니다.'
    assumptionInputs.value = []
    task.value = await getTask(props.taskId)
  } catch (err) {
    notice.value = err instanceof ApiError ? errorMessage(err.code, '요구 확인을 제출하지 못했습니다.') : '요구 확인을 제출하지 못했습니다.'
  } finally {
    confirming.value = false
  }
}

function dataField(data: unknown, key: string): string {
  const v = (data as Record<string, unknown> | null)?.[key]
  return typeof v === 'string' ? v : ''
}

function onEvent(e: TaskEvent) {
  // 연결이 살아 이벤트가 오면 재연결 횟수를 처음부터 센다 (SSE는 최대 5분마다 끊기므로 긴 승인 대기에도 이어서 받는다)
  reconnects.value = 0
  if (e.event === 'STEP_START') {
    activeStep.value = stepOf(e.data)
  } else if (e.event === 'STEP_END') {
    const s = stepOf(e.data)
    if (s && !doneSteps.value.includes(s)) doneSteps.value.push(s)
    if (activeStep.value === s) activeStep.value = ''
  } else if (e.event === 'CLARIFICATION_REQUIRED' || e.event === 'APPROVAL_REQUIRED') {
    refreshAnalysis().then(() => {
      if (e.event === 'APPROVAL_REQUIRED') {
        task.value = task.value ? { ...task.value, status: 'WAITING_APPROVAL' } : task.value
      }
      if (e.event === 'CLARIFICATION_REQUIRED') {
        task.value = task.value ? { ...task.value, status: 'NEEDS_CLARIFICATION' } : task.value
        fillAssumptions()
      }
    })
  }
  const ended = e.event === 'DONE' || e.event === 'RUN_END'
  const failed = e.event === 'FAILED' || e.event === 'RUN_FAILED'
  if (ended) doneOutcome.value = dataField(e.data, 'outcome')
  if (failed || e.event === 'RUN_ON_HOLD') stopReason.value = dataField(e.data, 'reason') || dataField(e.data, 'message')
  if (ended || failed || e.event === 'RUN_ON_HOLD') {
    finished.value = true
    stopped.value = e.event === 'RUN_ON_HOLD' ? 'ON_HOLD' : ended ? 'DONE' : 'FAILED'
  }
  // 고객 화면에는 내부 이벤트 내용을 쌓지 않는다
  if (isManager() || e.event === 'STEP_START' || e.event === 'STEP_END' || e.event === 'DONE' || e.event === 'FAILED' || e.event === 'RUN_END' || e.event === 'RUN_FAILED' || e.event === 'RUN_ON_HOLD') {
    events.value.push(e)
  }
}

// 끊긴 사이에 끝난 작업은 상태 응답에서 종료 정보를 복구한다
function applyTerminal(t: TaskState) {
  stopped.value = t.status
  if (t.status === 'DONE' && typeof t.outcome === 'string') doneOutcome.value = t.outcome
  if (t.status !== 'DONE') {
    const reason = t.failure_reason ?? (typeof t['hold_reason'] === 'string' ? (t['hold_reason'] as string) : '')
    if (reason) stopReason.value = reason
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
      applyTerminal(task.value)
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
    if (TERMINAL_STATUS.includes(task.value.status)) {
      finished.value = true
      applyTerminal(task.value)
    }
    if (task.value.status === 'NEEDS_CLARIFICATION') await refreshAnalysis().then(fillAssumptions)
    if (task.value.status === 'WAITING_APPROVAL') await refreshAnalysis()
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
        <AnalysisPanel :review="analysis.review" />
        <RouterLink v-if="rfq" :to="`/rfqs/${rfq}`">RFQ 상세 보기</RouterLink>
      </div>
      <!-- 승인 카드: 승인 대기 중인 DRAFT 견적에 대해 바로 승인·수정 요청·반려 -->
      <div v-for="q in draftQuotes" :key="q.quote_id" class="notice">
        <b>승인 요청 · 견적 <span class="num">{{ q.quote_id }}</span></b>
        <ApprovalActions :task-id="taskId" :quote-id="q.quote_id" @done="onDecided" @conflict="onDecided" />
      </div>
    </template>

    <ol class="log">
      <li v-for="(e, i) in events" :key="i">
        <span class="tag">{{ e.event }}</span>
        <code>{{ typeof e.data === 'string' ? e.data : JSON.stringify(e.data) }}</code>
      </li>
      <li v-if="!events.length" class="muted">진행 이벤트를 기다리는 중입니다.</li>
    </ol>

    <div v-if="needsClarification" class="notice">
      <b>요구 확인이 필요합니다</b>
      <p v-if="!assumptionInputs.length" class="muted">확인할 가정값을 불러오지 못했습니다. RFQ 화면에서 분석 결과를 확인해 주세요.</p>
      <form v-else @submit.prevent="confirmAssumptions">
        <label v-for="a in assumptionInputs" :key="a.field" class="field">
          <span>{{ a.field }}</span>
          <input v-model="a.value" />
        </label>
        <button class="btn" type="submit" :disabled="confirming">확인하고 계속 진행</button>
      </form>
    </div>

    <div v-if="finished" class="end" :class="stopped.toLowerCase()" role="status">
      <template v-if="stopped === 'DONE'">
        <b>작업이 끝났습니다.</b>
        <span>{{ OUTCOME_LABEL[doneOutcome] ?? '처리가 완료되었습니다.' }}</span>
      </template>
      <template v-else-if="stopped === 'ON_HOLD'">
        <b>작업이 보류되었습니다.</b>
        <span>업무상 담당자 조치가 필요해 자동 진행을 멈췄습니다.</span>
        <span v-if="isManager() && stopReason">사유: {{ stopReason }}</span>
      </template>
      <template v-else-if="stopped === 'FAILED'">
        <b>작업이 실패했습니다.</b>
        <span>잠시 후 다시 시도하거나 담당자에게 문의해 주세요.</span>
        <span v-if="isManager() && stopReason">사유: {{ stopReason }}</span>
      </template>
      <template v-else>
        <b>작업이 끝났습니다.</b>
        <span>상태: {{ label(TASK_LABEL, task?.status) }}</span>
      </template>
    </div>
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
.end { border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; background: var(--bg); border-left: 3px solid var(--accent); }
.end.failed { border-left-color: var(--err); }
.end.on_hold { border-left-color: var(--muted); }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; margin-bottom: 8px; }
.field input { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 8px 10px; font: inherit; }
.btn { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
