<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getTask, openTaskStream, type TaskEvent, type TaskState } from '../api/task'
import { getRfq } from '../api/rfq'
import { ApiError } from '../api/client'
import { isManager } from '../session'
import { errorMessage, label, OUTCOME_LABEL, STEP_LABEL, STEP_ORDER, TASK_LABEL, taskChip } from '../labels'
import StatusChip from '../components/StatusChip.vue'

const props = defineProps<{ taskId: string; rfq?: string }>()

const MAX_RECONNECT = 3
const TERMINAL_STATUS = ['DONE', 'FAILED', 'ON_HOLD']
// 업무상 종료 이벤트: 보류·실패·실행 종료는 담당자 조치 전까지 더 이벤트가 오지 않는다
const TERMINAL_EVENTS = ['DONE', 'FAILED', 'RUN_ON_HOLD', 'RUN_END', 'RUN_FAILED']
const EVENT_LABEL: Record<string, string> = {
  STEP_START: '단계 시작', STEP_END: '단계 완료', TOOL_START: '도구 호출', TOOL_END: '도구 응답',
  TOKEN: '문구 작성', CLARIFICATION_REQUIRED: '요구 확인 필요', APPROVAL_REQUIRED: '승인 요청',
  DONE: '완료', FAILED: '실패', RUN_ON_HOLD: '보류', RUN_END: '실행 종료', RUN_FAILED: '실행 실패',
}

const events = ref<{ at: string; name: string; text: string }[]>([])
const task = ref<TaskState | null>(null)
const activeStep = ref('')
const doneSteps = ref<string[]>([])
const finished = ref(false)
const outcome = ref<string | null>(null)
const reconnects = ref(0)
const notice = ref('')
const rfqNumber = ref('')
const logEl = ref<HTMLElement | null>(null)
let stop: (() => void) | null = null

// 대안 분석은 부품이 부족할 때만 나오므로, 실제로 들어왔거나 진행 중일 때만 보여 준다
const steps = computed(() => STEP_ORDER.filter((s) => s !== 'ALTERNATIVE_ANALYSIS' || doneSteps.value.includes(s) || activeStep.value === s))
const needsApproval = computed(() => events.value.some((e) => e.name === 'APPROVAL_REQUIRED'))
const failedReason = computed(() => {
  if (task.value?.status === 'ON_HOLD') return '업무상 보류되었습니다. 담당자 조치 후 다시 진행됩니다.'
  if (task.value?.status === 'FAILED' || events.value.some((e) => e.name === 'FAILED' || e.name === 'RUN_FAILED')) {
    return task.value?.failure_reason || events.value.filter((e) => e.name === 'FAILED' || e.name === 'RUN_FAILED').map((e) => e.text).pop() || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (events.value.some((e) => e.name === 'RUN_ON_HOLD')) return '업무상 보류되었습니다. 담당자 조치 후 다시 진행됩니다.'
  return ''
})
const needsClarify = computed(() => events.value.some((e) => e.name === 'CLARIFICATION_REQUIRED'))

function stepOf(data: unknown): string {
  // 고객에게는 단계와 시간만 온다. 필드명 step/name은 백엔드 확인 전 임시 가정.
  const d = data as { step?: string; name?: string } | null
  return d?.step ?? d?.name ?? ''
}

function describe(e: TaskEvent): string {
  if (e.event === 'STEP_START' || e.event === 'STEP_END') return STEP_LABEL[stepOf(e.data)] ?? stepOf(e.data)
  if (e.event === 'TOOL_START' || e.event === 'TOOL_END') return String((e.data as { tool?: string })?.tool ?? '')
  if (typeof e.data === 'string') return e.data
  if (e.data && typeof e.data === 'object' && 'reason' in e.data) return String((e.data as { reason: string }).reason)
  return ''
}

function onEvent(e: TaskEvent) {
  if (e.event === 'STEP_START') {
    activeStep.value = stepOf(e.data)
  } else if (e.event === 'STEP_END') {
    const s = stepOf(e.data)
    if (s && !doneSteps.value.includes(s)) doneSteps.value.push(s)
    if (activeStep.value === s) activeStep.value = ''
  }
  if (TERMINAL_EVENTS.includes(e.event)) finished.value = true
  // 반려도 정상 종료다. 결과는 DONE/RUN_END의 outcome으로 구분한다
  if ((e.event === 'DONE' || e.event === 'RUN_END') && e.data && typeof e.data === 'object' && 'outcome' in e.data) {
    outcome.value = String((e.data as { outcome: string }).outcome)
  }
  events.value.push({ at: new Date().toTimeString().slice(0, 8), name: e.event, text: describe(e) })
  nextTick(() => logEl.value?.scrollTo({ top: logEl.value.scrollHeight }))
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
      recover()
    },
  })
}

// 지난 이벤트는 다시 받을 수 없다. 상태를 먼저 확인하고, 끝나지 않았으면 다시 연결한다.
async function recover() {
  try {
    task.value = await getTask(props.taskId)
    if (task.value.current_step) activeStep.value = task.value.current_step
    outcome.value = task.value.outcome ?? outcome.value
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
    outcome.value = task.value.outcome ?? null
    if (TERMINAL_STATUS.includes(task.value.status)) finished.value = true
  } catch (err) {
    notice.value = err instanceof ApiError ? errorMessage(err.code, '작업을 찾을 수 없습니다.') : '작업을 불러오지 못했습니다.'
    return
  }
  if (props.rfq) {
    try {
      rfqNumber.value = (await getRfq(props.rfq)).rfq_number ?? ''
    } catch {
      // 번호가 없어도 진행 화면은 보여 준다
    }
  }
  if (!finished.value) start()
})
onBeforeUnmount(() => stop?.())
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ finished ? '검토가 끝났습니다' : '검토를 진행하고 있습니다' }}</h1>
        <p class="small muted num">{{ rfqNumber || '견적 검토' }} · 작업 {{ taskId }}</p>
      </div>
      <StatusChip :label="label(TASK_LABEL, task?.status)" :cls="taskChip(task?.status)" />
    </div>

    <section class="card" style="margin-bottom:16px">
      <div class="card-title">
        <h2>진행 단계</h2>
        <span class="sub">{{ isManager() ? '담당자 화면' : '고객 화면' }}</span>
      </div>
      <div class="track wide" aria-label="진행 단계">
        <div v-for="s in steps" :key="s" :class="doneSteps.includes(s) ? 'done' : s === activeStep ? 'cur' : ''">
          <b>{{ STEP_LABEL[s] }}</b>
          {{ doneSteps.includes(s) ? '완료' : s === activeStep ? '진행 중' : '대기' }}
        </div>
      </div>
    </section>

    <div v-if="needsApproval || needsClarify" class="notice warn" style="margin-bottom:16px">
      <div class="spread">
        <div>
          <b>{{ needsApproval ? '승인 요청이 도착했습니다' : '담당자 확인이 필요합니다' }}</b>
          <p class="small muted" style="margin-top:2px">{{ isManager() ? '분석 결과에서 항목을 확인하고 결정해 주세요.' : '담당자가 확인하고 있습니다. 완료되면 견적을 볼 수 있습니다.' }}</p>
        </div>
        <RouterLink v-if="isManager() && rfq" class="btn primary sm" :to="`/rfqs/${rfq}`">검토 화면으로</RouterLink>
      </div>
    </div>

    <div v-if="finished && outcome && OUTCOME_LABEL[outcome]" class="notice" style="margin-bottom:16px">
      <b>{{ OUTCOME_LABEL[outcome] }}</b>
    </div>
    <div v-else-if="failedReason" class="notice warn" style="margin-bottom:16px">
      <b>작업이 중단되었습니다</b>
      <p class="small muted" style="margin-top:2px">{{ failedReason }}</p>
    </div>

    <section class="card" style="margin-bottom:16px">
      <div class="card-title"><h2>진행 기록</h2><span class="sub">{{ events.length }}건</span></div>
      <ol ref="logEl" class="log">
        <li v-for="(e, i) in events" :key="i" :class="e.name">
          <span class="time num">{{ e.at }}</span>
          <span class="ename">{{ EVENT_LABEL[e.name] ?? e.name }}</span>
          <span class="etext">{{ e.text }}</span>
        </li>
        <li v-if="!events.length" class="muted">진행 이벤트를 기다리는 중입니다.</li>
      </ol>
      <p v-if="!finished && !notice" class="small muted" style="margin-top:10px">연결이 끊기면 자동으로 상태를 확인하고 다시 연결합니다.</p>
      <p v-if="notice" class="err" role="alert" style="margin-top:10px">{{ notice }}</p>
    </section>

    <div class="spread">
      <RouterLink to="/rfqs">← 메인으로</RouterLink>
      <RouterLink v-if="rfq && finished" class="btn primary" :to="`/rfqs/${rfq}`">견적 보러 가기</RouterLink>
    </div>
  </div>
</template>
