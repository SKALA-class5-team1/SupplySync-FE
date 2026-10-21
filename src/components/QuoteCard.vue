<script setup lang="ts">
import { computed } from 'vue'
import { label, QUOTE_LABEL } from '../labels'

// 견적 한 건. 고객용(CustomerQuote)과 담당자용(ManagerQuote)은 응답 필드가 다르다.
// 원가·마진·최종 검토 결과(parts_cost_krw, margin_pct, checks)는 담당자 화면에서만 보여 준다.
const props = defineProps<{ quote: Record<string, unknown>; manager: boolean }>()

interface YearPrice { year: number; unit_price_krw: number; margin_pct?: number }
interface Condition { type?: string; text?: string; ref?: string; extra_cost_krw?: number }
interface Check { rule?: string; label?: string; criterion?: string; value?: string; result?: string; ref?: string }

const q = computed(() => props.quote)
const won = (v: unknown) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}원` : '–')
const text = (v: unknown) => (v === null || v === undefined || v === '' ? '–' : String(v))
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

const years = computed(() => list<YearPrice>(q.value.price_by_year))
const conditions = computed(() => list<Condition>(q.value.conditions))
const checks = computed(() => (props.manager ? list<Check>(q.value.checks) : []))
const options = computed(() => list<string>(q.value.options).join(', ') || '–')

const CONDITION_LABEL: Record<string, string> = {
  ASSUMPTION: '가정',
  SUBSTITUTE_PART: '대체 부품',
  CONTRACT_PROPOSAL: '계약 수정 제안',
}
</script>

<template>
  <div class="quote">
    <dl class="meta">
      <dt>모델</dt><dd>{{ text(q.model_id) }}</dd>
      <dt>옵션</dt><dd>{{ options }}</dd>
      <dt>단가</dt><dd><b>{{ won(q.unit_price_krw) }}</b></dd>
      <dt>시작품</dt><dd>{{ text(q.sample_qty) }}개 · 납기 {{ text(q.sample_due_date) }}</dd>
      <dt>유효기간</dt><dd>{{ text(q.valid_until) }}</dd>
      <dt>상태</dt><dd>{{ label(QUOTE_LABEL, q.status as string) }}</dd>
      <template v-if="manager">
        <dt>부품 원가</dt><dd>{{ won(q.parts_cost_krw) }}</dd>
        <dt>마진</dt><dd>{{ typeof q.margin_pct === 'number' ? `${q.margin_pct}%` : '–' }}</dd>
        <dt v-if="q.reject_reason">사유</dt><dd v-if="q.reject_reason">{{ q.reject_reason }}</dd>
      </template>
    </dl>

    <template v-if="years.length">
      <h4>연도별 단가</h4>
      <table>
        <thead>
          <tr><th>연차</th><th>단가</th><th v-if="manager">마진</th></tr>
        </thead>
        <tbody>
          <tr v-for="y in years" :key="y.year">
            <td>{{ y.year }}년차</td>
            <td>{{ won(y.unit_price_krw) }}</td>
            <td v-if="manager">{{ typeof y.margin_pct === 'number' ? `${y.margin_pct}%` : '–' }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-if="conditions.length">
      <h4>조건</h4>
      <ul class="conds">
        <li v-for="(c, i) in conditions" :key="i">
          <span class="chip">{{ CONDITION_LABEL[c.type ?? ''] ?? c.type ?? '조건' }}</span>
          {{ c.text }}
          <span v-if="c.extra_cost_krw" class="muted"> (추가 {{ won(c.extra_cost_krw) }})</span>
          <span v-if="c.ref" class="muted"> · {{ c.ref }}</span>
        </li>
      </ul>
    </template>

    <template v-if="checks.length">
      <h4>최종 검토 결과 (내부용)</h4>
      <ul class="conds">
        <li v-for="(c, i) in checks" :key="i">
          <span class="chip" :class="{ fail: c.result === 'FAIL' }">{{ c.result }}</span>
          {{ c.label }} — {{ c.criterion }} → {{ c.value }}
          <span v-if="c.ref" class="muted"> · {{ c.ref }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.quote { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.meta { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0; }
dt { color: var(--muted); }
dd { margin: 0; }
h4 { margin: 6px 0 0; font-size: 13px; }
table { border-collapse: collapse; width: 100%; max-width: 420px; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; }
.conds { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
.chip { font-size: 11.5px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft, #e4eaf3); color: var(--accent); margin-right: 4px; }
.chip.fail { color: var(--err); }
.muted { color: var(--muted); }
</style>
