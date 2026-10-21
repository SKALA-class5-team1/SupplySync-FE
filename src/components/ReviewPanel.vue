<script setup lang="ts">
import { ref, watch } from 'vue'
import { submitConfirmation } from '../api/ai'
import { ApiError } from '../api/client'
import { errorMessage, SEVERITY_LABEL, severityChip, won } from '../labels'
import { notify } from '../toast'
import type { Review } from '../api/types'

const props = defineProps<{ review: Review; taskId: string }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const assumptions = ref<{ field: string; value: string }[]>([])
const saving = ref(false)
const copied = ref(false)

watch(
  () => props.review,
  (r) => {
    assumptions.value = (r?.assumptions ?? []).map((a) => ({ ...a }))
  },
  { immediate: true },
)

async function saveAssumptions() {
  if (!props.taskId) {
    notify('작업 정보가 없어 가정을 제출할 수 없습니다.', 'err')
    return
  }
  saving.value = true
  try {
    await submitConfirmation(props.taskId, assumptions.value)
    notify('요구 확인을 제출했습니다.', 'ok')
    emit('changed')
  } catch (err) {
    notify(err instanceof ApiError ? errorMessage(err.code, '제출하지 못했습니다.') : '제출하지 못했습니다.', 'err')
  } finally {
    saving.value = false
  }
}

async function copyQuestions() {
  const text = (props.review.customer_questions ?? []).map((q, i) => `${i + 1}. ${q}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    notify('복사하지 못했습니다. 직접 선택해 주세요.', 'err')
  }
}
</script>

<template>
  <div class="stack">
    <div v-if="review.proposal_summary" class="notice">
      <b class="small">검토 요약</b>
      <p class="small" style="margin-top:4px">{{ review.proposal_summary }}</p>
    </div>

    <section>
      <div class="card-title"><h2>검토 항목</h2><span class="sub">{{ review.issues?.length ?? 0 }}건</span></div>
      <p v-if="!review.issues?.length" class="muted small">확인할 항목이 없습니다.</p>
      <ul v-else class="issues">
        <li v-for="(i, idx) in review.issues" :key="idx">
          <span class="chip" :class="severityChip(i.severity)">{{ SEVERITY_LABEL[i.severity] ?? i.severity }}</span>
          <div class="issue-body">
            <b>{{ i.title }}</b>
            <span class="small muted">{{ i.detail }}</span>
            <span v-if="i.assumption" class="assume small">가정: {{ i.assumption }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="assumptions.length">
      <div class="card-title"><h2>요구 확인</h2><span class="sub">고객 가정을 확인하고 제출합니다</span></div>
      <div class="stack" style="gap:10px">
        <div v-for="(a, idx) in assumptions" :key="idx" class="field">
          <label :for="`as-${idx}`">{{ a.field }}</label>
          <input :id="`as-${idx}`" v-model="a.value" class="input" />
        </div>
      </div>
      <div class="btns" style="justify-content:flex-end;margin-top:12px">
        <button class="btn primary" :disabled="saving" @click="saveAssumptions">{{ saving ? '제출 중…' : '요구 확인 제출' }}</button>
      </div>
    </section>

    <section v-if="review.shortages?.length">
      <div class="card-title"><h2>부족 부품</h2><span class="sub">가용 = 재고 − 배정</span></div>
      <div class="tw">
        <table>
          <thead><tr><th>부품</th><th class="r">필요</th><th class="r">가용</th><th class="r">부족</th><th>입고 예정</th></tr></thead>
          <tbody>
            <tr v-for="s in review.shortages" :key="s.part_id">
              <td>{{ s.part_name }} <span class="faint small num">{{ s.part_id }}</span></td>
              <td class="r num">{{ s.required.toLocaleString('ko-KR') }}</td>
              <td class="r num">{{ s.available.toLocaleString('ko-KR') }}</td>
              <td class="r num"><b>{{ s.shortfall.toLocaleString('ko-KR') }}</b></td>
              <td class="num muted">{{ s.eta ?? '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="review.alternatives?.length">
      <div class="card-title"><h2>대안 비교</h2><span class="sub">납기와 추가 비용을 함께 봅니다</span></div>
      <div class="alts">
        <article v-for="a in review.alternatives" :key="a.alt_id" class="alt" :class="{ rec: a.recommended }">
          <div class="spread">
            <span class="alt-id">{{ a.alt_id }}</span>
            <span v-if="a.recommended" class="chip accepted">추천</span>
          </div>
          <b>{{ a.title }}</b>
          <p class="small muted">{{ a.summary }}</p>
          <dl class="alt-meta small">
            <div><dt>추가 비용</dt><dd class="num">{{ won(a.extra_cost_krw) }}</dd></div>
            <div><dt>소요</dt><dd class="num">{{ a.lead_days != null ? `${a.lead_days}일` : '–' }}</dd></div>
          </dl>
          <p v-if="a.risk" class="small risk">주의: {{ a.risk }}</p>
        </article>
      </div>
    </section>

    <section v-if="review.contract_risks?.length">
      <div class="card-title"><h2>계약 리스크</h2><span class="sub">사내 기준과 비교</span></div>
      <div class="items">
        <div v-for="(r, idx) in review.contract_risks" :key="idx" class="notice">
          <b class="small">{{ r.clause }}</b>
          <p class="small muted">{{ r.summary }}<template v-if="r.limit"> · 한도 {{ r.limit }}</template></p>
        </div>
      </div>
    </section>

    <section v-if="review.customer_questions?.length">
      <div class="card-title">
        <h2>고객 확인 질의서</h2>
        <button class="btn sm" @click="copyQuestions">{{ copied ? '복사됨' : '복사' }}</button>
      </div>
      <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
        <li v-for="(q, idx) in review.customer_questions" :key="idx">{{ q }}</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.issues li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line-soft); border-radius: 10px; }
.issue-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.faint { color: var(--faint); }
</style>
