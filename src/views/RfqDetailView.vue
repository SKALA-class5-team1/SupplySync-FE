<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAnalysis, getCustomerQuotes, getRfq } from '../api/rfq'
import ApprovalActions from '../components/ApprovalActions.vue'
import AnalysisPanel from '../components/AnalysisPanel.vue'
import QuoteCard from '../components/QuoteCard.vue'
import { ApiError } from '../api/client'
import { isManager } from '../session'
import { errorMessage, label, QUOTE_LABEL, RFQ_LABEL } from '../labels'
import type { AnalysisResponse, QuoteSummary, RfqSummary } from '../api/types'

const props = defineProps<{ rfqId: string }>()

const rfq = ref<RfqSummary | null>(null)
const analysis = ref<AnalysisResponse | null>(null)
const quotes = ref<QuoteSummary[]>([])
const notice = ref('')
const error = ref('')

// 승인 요청은 작업(task) 기준이다. RFQ 응답에 task_id가 있어야 승인할 수 있다.
const taskId = computed(() => (rfq.value?.task_id as string | undefined) ?? '')

async function load() {
  error.value = ''
  try {
    rfq.value = await getRfq(props.rfqId)
    if (isManager()) {
      analysis.value = await getAnalysis(props.rfqId)
      quotes.value = analysis.value.quotes
    } else {
      quotes.value = await getCustomerQuotes(props.rfqId)
    }
  } catch (err) {
    error.value = err instanceof ApiError
      ? errorMessage(err.code, '불러오지 못했습니다.')
      : '불러오지 못했습니다.'
  }
}

onMounted(load)
</script>

<template>
  <section class="card">
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <template v-else-if="rfq">
      <div class="head">
        <div>
          <h1>{{ rfq.rfq_number ?? rfq.rfq_id }}</h1>
          <p class="muted">상태: {{ label(RFQ_LABEL, rfq.status) }}</p>
        </div>
        <RouterLink :to="taskId ? `/tasks/${taskId}` : '/rfqs'">{{ taskId ? '진행 보기' : '목록으로' }}</RouterLink>
      </div>

      <h2>견적</h2>
      <p v-if="!quotes.length" class="muted">표시할 견적이 없습니다.</p>
      <ul v-else class="quotes">
        <li v-for="q in quotes" :key="q.quote_id" class="quote">
          <div class="row">
            <b class="num">{{ q.quote_id }}</b>
            <span class="chip">{{ label(QUOTE_LABEL, q.status) }}</span>
          </div>
          <QuoteCard :quote="q" :manager="isManager()" />

          <!-- 담당자 승인 · 반려 (DRAFT 견적만) -->
          <ApprovalActions v-if="isManager() && q.status === 'DRAFT' && taskId" :task-id="taskId" :quote-id="q.quote_id" @done="load" @conflict="load" />
          <p v-else-if="isManager() && q.status === 'DRAFT'" class="muted">이 RFQ의 작업 정보가 없어 승인할 수 없습니다.</p>
        </li>
      </ul>

      <!-- 담당자 전용 분석 결과 (review 내부 필드는 Swagger 스키마 확인 후 화면을 나눈다) -->
      <template v-if="isManager() && analysis">
        <h2>분석 결과</h2>
        <AnalysisPanel :review="analysis.review" />
      </template>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    </template>
    <p v-else class="muted">불러오는 중…</p>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h1 { margin: 0; font-size: 22px; }
h2 { margin: 8px 0 0; font-size: 16px; }
.muted { color: var(--muted); margin: 4px 0 0; font-size: 13px; }
.err { color: var(--err); margin: 0; }
.notice { margin: 0; font-size: 13px; }
.quotes { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.quote { border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.chip { font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: var(--accent-soft, #e4eaf3); color: var(--accent); }
.json { background: var(--bg); border-radius: 8px; padding: 10px; font-size: 12px; overflow-x: auto; margin: 0; }
</style>
