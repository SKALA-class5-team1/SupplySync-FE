<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { submitConfirmation } from '../api/ai'
import { ApiError } from '../api/client'
import { errorMessage, SEVERITY_LABEL, severityChip, won } from '../labels'
import { notify } from '../toast'
import type { Review, TaskStatus } from '../api/types'

const ALT_LABEL: Record<string, string> = {
  WAIT_INCOMING: '입고 대기', PARTIAL_DELIVERY: '분할 납품', SUBSTITUTE_PART: '대체 부품', NEW_ORDER: '신규 발주',
}

const props = defineProps<{ review: Review; taskId: string; taskStatus?: TaskStatus }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const assumptions = ref<{ field: string; value: string }[]>([])
const saving = ref(false)
const submitted = ref(false)
const confirmationError = ref('')
const copied = ref(false)
const needsClarification = computed(() => props.taskStatus === 'NEEDS_CLARIFICATION')

watch(
  () => [props.review, props.taskId] as const,
  ([r]) => {
    // SG1이 이슈만 저장한 경우에도 담당자가 확정값을 직접 입력할 수 있어야 한다.
    // suggestion은 설명 문장이므로 확정값으로 자동 제출하지 않는다.
    const fields = [...new Set((r.issues ?? []).map((i) => i.field?.trim()).filter((f): f is string => !!f))]
    assumptions.value = r.assumptions?.length
      ? r.assumptions.map(({ field, value }) => ({ field, value }))
      : fields.length ? fields.map((field) => ({ field, value: '' })) : [{ field: '', value: '' }]
    confirmationError.value = ''
    submitted.value = false
  },
  { immediate: true },
)

async function saveAssumptions() {
  if (saving.value || submitted.value) return
  confirmationError.value = ''
  if (!props.taskId || !needsClarification.value) {
    confirmationError.value = '요구 확인 대기 상태에서만 제출할 수 있습니다. 최신 상태를 확인해 주세요.'
    return
  }
  const values = assumptions.value.map(({ field, value }) => ({ field: field.trim(), value: value.trim() }))
  if (!values.length || values.some((a) => !a.field || !a.value)) {
    confirmationError.value = '확정할 항목과 값을 입력해 주세요. 제출하지 않을 항목은 제외할 수 있습니다.'
    return
  }
  if (new Set(values.map((a) => a.field)).size !== values.length) {
    confirmationError.value = '같은 항목이 중복되어 있습니다. 항목별로 하나의 확정값을 입력해 주세요.'
    return
  }
  saving.value = true
  try {
    await submitConfirmation(props.taskId, values)
    submitted.value = true
    notify('요구 확인을 제출하고 분석 재개를 요청했습니다.', 'ok')
    emit('changed')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      notify('작업 상태가 변경되었습니다. 최신 상태를 확인합니다.', 'err')
      emit('changed')
    } else {
      confirmationError.value = err instanceof ApiError ? errorMessage(err.code, '제출하지 못했습니다.') : '제출하지 못했습니다.'
    }
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
    <form v-if="needsClarification" class="confirmation stack" @submit.prevent="saveAssumptions">
      <div class="spread">
        <h2>담당자 요구 확인</h2>
        <button type="submit" class="btn primary" :disabled="saving || submitted || !taskId">{{ saving ? '제출 중…' : submitted ? '재개 요청 완료' : '확인 완료 · 분석 재개' }}</button>
      </div>
      <p class="small muted">아래 이슈를 검토하고 확정값을 입력해 주세요. 확인을 제출하면 분석이 재개되고, 견적이 작성된 뒤 최종 승인할 수 있습니다.</p>
      <fieldset :disabled="saving || submitted" class="stack confirmation-fields">
        <div v-for="(a, idx) in assumptions" :key="idx" class="confirmation-row stack">
          <div class="spread">
            <label class="small" :for="`as-field-${idx}`">확인 항목 {{ idx + 1 }}</label>
            <button type="button" class="btn sm" :aria-label="`${a.field || '확인 항목 ' + (idx + 1)} 제외`" @click="assumptions.splice(idx, 1)">제외</button>
          </div>
          <input :id="`as-field-${idx}`" v-model="a.field" class="input" placeholder="예: spec.flow" required />
          <p v-if="review.issues?.find((i) => i.field === a.field)?.suggestion" class="small muted">제안: {{ review.issues.find((i) => i.field === a.field)?.suggestion }}</p>
          <div class="field">
            <label :for="`as-${idx}`">확정값</label>
            <input :id="`as-${idx}`" v-model="a.value" class="input" placeholder="담당자가 확인한 값을 입력하세요" required />
          </div>
        </div>
        <div class="btns">
          <button type="button" class="btn sm" @click="assumptions.push({ field: '', value: '' })">확인 항목 추가</button>
          <span class="small muted">이번에 확정하지 않을 항목은 제외할 수 있습니다.</span>
        </div>
      </fieldset>
      <p v-if="confirmationError" class="err" role="alert">{{ confirmationError }}</p>
    </form>
    <section v-else-if="review.assumptions?.length">
      <div class="card-title"><h2>가정값</h2></div>
      <dl class="assumption-values small">
        <template v-for="(a, idx) in review.assumptions" :key="idx">
          <dt>{{ a.field }}</dt><dd>{{ a.value }}</dd>
        </template>
      </dl>
    </section>

    <section>
      <div class="card-title"><h2>검토 항목</h2><span class="sub">{{ review.issues?.length ?? 0 }}건</span></div>
      <p v-if="!review.issues?.length" class="muted small">확인할 항목이 없습니다.</p>
      <ul v-else class="issues">
        <li v-for="(i, idx) in review.issues" :key="i.id ?? idx">
          <span class="chip" :class="severityChip(i.severity)">{{ SEVERITY_LABEL[i.severity] ?? i.severity }}</span>
          <div class="issue-body">
            <b>{{ i.type ? `[${i.type}] ` : '' }}{{ i.field ?? i.id }}</b>
            <span v-if="i.found" class="small">확인값: {{ i.found }}</span>
            <span class="small muted">{{ i.reason }}</span>
            <span v-if="i.suggestion" class="assume small">가정: {{ i.suggestion }}</span>
            <span v-if="i.ref" class="small faint">근거: {{ i.ref }}</span>
            <details v-if="i.evidence?.length" class="small">
              <summary>근거 문서 {{ i.evidence.length }}건</summary>
              <p v-for="e in i.evidence" :key="e.chunk_id" class="muted">[{{ e.chunk_id }} {{ e.section }}] {{ e.excerpt }}</p>
            </details>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="review.shortages?.length">
      <div class="card-title"><h2>부족 부품</h2><span class="sub">가용 = 재고 − 배정</span></div>
      <div class="tw">
        <table>
          <thead><tr><th>부품</th><th class="r">필요</th><th class="r">가용</th><th class="r">부족</th><th>입고 예정</th></tr></thead>
          <tbody>
            <tr v-for="s in review.shortages" :key="s.part_id">
              <td>{{ s.part_name ?? s.part_id }} <span class="faint small num">{{ s.part_id }}</span></td>
              <td class="r num">{{ s.required_qty?.toLocaleString('ko-KR') ?? '–' }}</td>
              <td class="r num">{{ s.available?.toLocaleString('ko-KR') ?? '–' }}</td>
              <td class="r num"><b>{{ s.short_qty?.toLocaleString('ko-KR') ?? '–' }}</b></td>
              <td class="num muted">{{ s.incoming_date ? `${s.incoming_date} (${s.incoming_qty?.toLocaleString('ko-KR') ?? '?'}개)` : '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="review.alternatives?.length">
      <div class="card-title"><h2>대안 비교</h2><span class="sub">납기와 추가 비용을 함께 봅니다</span></div>
      <div class="alts">
        <article v-for="a in review.alternatives" :key="a.type" class="alt" :class="{ rec: a.recommended }">
          <div class="spread">
            <span class="alt-id">{{ ALT_LABEL[a.type] ?? a.type }}</span>
            <span v-if="a.recommended" class="chip accepted">추천</span>
          </div>
          <b>{{ a.label }}</b>
          <p class="small muted">{{ a.reason }}</p>
          <dl class="alt-meta small">
            <div><dt>납기</dt><dd>{{ a.feasible === false ? '불가' : a.meets_due_date ? '충족' : `${a.delay_days ?? '?'}일 초과` }}</dd></div>
            <div><dt>추가 비용</dt><dd class="num">{{ won(a.extra_cost_krw) }}</dd></div>
            <div v-if="a.covered_qty != null"><dt>충당 수량</dt><dd class="num">{{ a.covered_qty.toLocaleString('ko-KR') }}개</dd></div>
            <div v-if="a.substitute_part_id"><dt>대체 부품</dt><dd>{{ a.substitute_part_id }} ({{ a.substitute_supplier }})</dd></div>
            <div v-if="a.validation_days != null"><dt>검증 기간</dt><dd class="num">{{ a.validation_days }}일</dd></div>
            <div v-if="a.on_time_qty != null"><dt>납기 내/후</dt><dd class="num">{{ a.on_time_qty }} / {{ a.late_qty ?? 0 }}</dd></div>
            <div v-if="a.lead_time_days != null"><dt>조달 기간</dt><dd class="num">{{ a.lead_time_days }}일</dd></div>
          </dl>
          <details v-if="a.evidence?.length" class="small">
            <summary>근거 문서 {{ a.evidence.length }}건</summary>
            <p v-for="e in a.evidence" :key="e.chunk_id" class="muted">[{{ e.chunk_id }} {{ e.section }}] {{ e.excerpt }}</p>
          </details>
        </article>
      </div>
    </section>

    <section v-if="review.contract_risks?.length">
      <div class="card-title"><h2>계약 리스크</h2><span class="sub">사내 기준과 비교</span></div>
      <div class="items">
        <div v-for="(r, idx) in review.contract_risks" :key="idx" class="notice">
          <b class="small">{{ r.item }}</b>
          <p class="small muted"><template v-if="r.limit">사내 한도 {{ r.limit }}</template><template v-if="r.ref"> · {{ r.ref }}</template></p>
          <details v-if="r.evidence?.length" class="small">
            <summary>근거 문서 {{ r.evidence.length }}건</summary>
            <p v-for="e in r.evidence" :key="e.chunk_id" class="muted">[{{ e.chunk_id }} {{ e.section }}] {{ e.excerpt }}</p>
          </details>
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
.confirmation { border: 1px solid var(--accent); background: var(--paper); border-radius: 10px; padding: 14px; }
.confirmation h2, .confirmation p { margin: 0; }
.confirmation-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
.confirmation-row { gap: 6px; padding-top: 12px; border-top: 1px solid var(--line); }
.assumption-values { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; overflow-wrap: anywhere; }
.assumption-values dd { margin: 0; }
.issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.issues li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line-soft); border-radius: 10px; }
.issue-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.faint { color: var(--faint); }
</style>
