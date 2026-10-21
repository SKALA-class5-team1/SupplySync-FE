<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getAnalysis, getCustomerQuotes, getRfq, listRfqs } from '../api/rfq'
import { getTask, type TaskState } from '../api/task'
import { ApiError } from '../api/client'
import { isManager } from '../session'
import { errorMessage, label, LIFECYCLE, lifecycleIndex, RFQ_LABEL, rfqChip, TASK_LABEL, taskChip } from '../labels'
import StatusChip from '../components/StatusChip.vue'
import Track from '../components/Track.vue'
import ReviewPanel from '../components/ReviewPanel.vue'
import QuotePanel from '../components/QuotePanel.vue'
import type { QuoteSummary, Review, RfqDetail, RfqSummary } from '../api/types'

const props = defineProps<{ rfqId: string }>()
const route = useRoute()

const list = ref<RfqSummary[]>([])
const rfq = ref<RfqDetail | null>(null)
const review = ref<Review | null>(null)
const quotes = ref<QuoteSummary[]>([])
const task = ref<TaskState | null>(null)
const loading = ref(true)
const error = ref('')

// 아티팩트의 두 기준: 고객 기준 / 담당자 기준. 담당자는 둘 다 볼 수 있고, 고객은 고객 기준만 본다.
const view = computed<'customer' | 'staff'>(() => {
  if (!isManager()) return 'customer'
  return route.query.view === 'customer' ? 'customer' : 'staff'
})
const taskId = computed(() => rfq.value?.latest_task_id ?? '')
const draftCount = computed(() => quotes.value.filter((q) => q.status === 'DRAFT').length)
const idx = computed(() => lifecycleIndex(rfq.value?.status, draftCount.value > 0))
const taskNotice = computed(() => {
  switch (task.value?.status) {
    case 'NEEDS_CLARIFICATION': return '담당자 확인을 기다리고 있습니다. 아래에서 확정값을 제출하면 분석이 재개됩니다. 최종 견적 승인은 견적 작성 후 진행합니다.'
    case 'WAITING_APPROVAL': return draftCount.value ? '승인할 견적이 준비되었습니다. 견적과 조건을 확인하고 승인·반려·수정 요청을 선택해 주세요.' : '승인 대기 중이지만 견적을 아직 불러오지 못했습니다. 새로고침해 주세요.'
    case 'REVALIDATING': return '승인이 접수되어 최신 재고와 가격을 다시 확인하고 있습니다.'
    case 'REGISTERING': return '승인된 견적을 등록하고 있습니다.'
    case 'ON_HOLD': return '분석이 보류되었습니다. 진행 기록과 검토 항목을 확인해 주세요.'
    case 'FAILED': return task.value.failure_reason || '분석이 중단되었습니다. 진행 기록을 확인해 주세요.'
    case 'DONE': return '검토가 종료되었습니다. 아래에서 견적 결과를 확인해 주세요.'
    default: return taskId.value ? '분석을 진행하고 있습니다. 견적 작성과 최종 검토가 끝나면 승인할 수 있습니다.' : '연결된 분석 작업이 없어 확인이나 승인을 제출할 수 없습니다.'
  }
})
let loadSequence = 0

async function load() {
  const sequence = ++loadSequence
  const rfqId = props.rfqId
  loading.value = true
  error.value = ''
  task.value = null
  try {
    const [items, detail] = await Promise.all([listRfqs(), getRfq(rfqId)])
    if (sequence !== loadSequence) return
    list.value = items
    rfq.value = detail
    if (isManager()) {
      const [a, state] = await Promise.all([
        getAnalysis(rfqId),
        detail.latest_task_id ? getTask(detail.latest_task_id) : Promise.resolve(null),
      ])
      if (sequence !== loadSequence) return
      review.value = a.review
      quotes.value = a.quotes
      task.value = state
    } else {
      const customerQuotes = await getCustomerQuotes(rfqId)
      if (sequence !== loadSequence) return
      quotes.value = customerQuotes
      review.value = null
    }
  } catch (err) {
    if (sequence !== loadSequence) return
    error.value = err instanceof ApiError ? errorMessage(err.code, '불러오지 못했습니다.') : '불러오지 못했습니다.'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

watch(() => props.rfqId, load, { immediate: true })
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>견적 승인</h1>
        <p>{{ view === 'customer' ? '고객이 확인하는 견적과 진행 상황입니다.' : '접수된 RFQ를 검토하고 견적을 승인합니다.' }}</p>
      </div>
      <nav v-if="isManager()" class="seg" aria-label="승인 기준">
        <RouterLink :to="{ query: { view: 'customer' } }" :aria-current="view === 'customer' ? 'page' : undefined">고객 기준</RouterLink>
        <RouterLink :to="{ query: { view: 'staff' } }" :aria-current="view === 'staff' ? 'page' : undefined">담당자 기준</RouterLink>
      </nav>
    </div>

    <div class="grid2">
      <aside class="stack">
        <h2>{{ isManager() ? '접수된 RFQ' : '내 RFQ' }}</h2>
        <ul class="items">
          <li v-for="r in list" :key="r.rfq_id">
            <RouterLink class="item" :to="`/rfqs/${r.rfq_id}${route.query.view ? '?view=' + route.query.view : ''}`" :aria-current="String(r.rfq_id) === String(rfqId) ? 'true' : undefined" style="text-decoration:none;color:inherit">
              <span class="t">{{ r.item ?? r.rfq_number }}</span>
              <span class="m"><span class="num">{{ r.rfq_number }}</span><StatusChip :label="label(RFQ_LABEL, r.status)" :cls="rfqChip(r.status)" /></span>
            </RouterLink>
          </li>
          <li v-if="!list.length" class="muted small">표시할 RFQ가 없습니다.</li>
        </ul>
      </aside>

      <section class="stack">
        <div v-if="loading" class="card stack">
          <div class="skeleton" style="width:40%"></div>
          <div class="skeleton" style="width:70%"></div>
          <div class="skeleton" style="width:90%"></div>
        </div>
        <div v-else-if="error" class="empty"><b>{{ error }}</b></div>

        <template v-else-if="rfq">
          <div class="card stack">
            <div class="spread">
              <div>
                <div class="small muted num">{{ rfq.rfq_number }} · {{ rfq.customer_company ?? '' }} · 접수 {{ (rfq.received_at ?? '').slice(0, 10) || '–' }}</div>
                <h2 style="font-size:18px;margin-top:2px">{{ rfq.item ?? '견적 요청' }}</h2>
              </div>
              <div class="row">
                <StatusChip :label="label(RFQ_LABEL, rfq.status)" :cls="rfqChip(rfq.status)" />
                <RouterLink v-if="taskId" class="btn sm" :to="`/tasks/${taskId}?rfq=${rfq.rfq_id}`">진행 보기</RouterLink>
              </div>
            </div>
            <Track :items="LIFECYCLE" :index="idx" />
            <div v-if="view === 'staff'" class="notice">
              <div class="spread">
                <StatusChip :label="label(TASK_LABEL, task?.status)" :cls="taskChip(task?.status)" />
                <button class="btn sm" @click="load">새로고침</button>
              </div>
              <p class="small muted" style="margin:8px 0 0">{{ taskNotice }}</p>
              <a v-if="task?.status === 'WAITING_APPROVAL' && draftCount" class="btn primary" href="#quote-review" style="margin-top:10px">견적 검토·승인</a>
            </div>
          </div>

          <div v-if="view === 'staff' && review" class="card">
            <ReviewPanel :review="review" :task-id="taskId" :task-status="task?.status" @changed="load" />
          </div>

          <div v-if="view === 'customer' && !quotes.length" class="notice">
            <b>담당자가 견적을 검토 중입니다</b>
            <p class="small muted" style="margin-top:4px">등록이 끝나면 단가와 조건을 이 화면에서 확인할 수 있습니다.</p>
          </div>

          <QuotePanel
            id="quote-review"
            v-if="quotes.length || view === 'staff'"
            :quotes="quotes"
            :manager="view === 'staff'"
            :task-id="taskId"
            :task-status="task?.status"
            @changed="load"
          />
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
</style>
