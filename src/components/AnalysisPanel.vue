<script setup lang="ts">
import { computed } from 'vue'

// 담당자 분석 결과. review 내부 필드명은 백엔드 스키마 확인 전이라 구조를 가정하지 않고,
// 최상위 키마다 목록·값을 그대로 풀어 보여 준다. 근거(evidence: chunk_id, section, excerpt)가 있으면 펼쳐 볼 수 있다.
const props = defineProps<{ review: Record<string, unknown> }>()

const SECTION_LABEL: Record<string, string> = {
  issues: '이슈',
  assumptions: '가정값',
  contract_risks: '계약 리스크',
  customer_questions: '고객 질의서',
  shortages: '부족 부품',
  alternatives: '대안',
  supply_check: '공급 확인',
  demand: '물량·일정',
  selected_model: '선택 모델',
  options: '옵션',
  fit_type: '적합 유형',
  passed_checks: '통과한 검증',
  recommended_alt: '추천 대안',
  final_plan: '최종 부품 계획',
  confirmed_by: '확인한 담당자',
  confirmed_at: '확인 시각',
}

// 화면에 보여 줄 필요가 없는 내부 식별 필드
const HIDDEN = new Set(['thread_id', 'rfq_number', 'status'])

interface Evidence { chunk_id?: string; section?: string; excerpt?: string }
type Row = Record<string, unknown>

const sections = computed(() =>
  Object.entries(props.review ?? {}).filter(([key, value]) => !HIDDEN.has(key) && value !== null).map(([key, value]) => ({
    key,
    title: SECTION_LABEL[key] ?? key,
    items: Array.isArray(value) ? value : null,
    value,
  })),
)

const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v)

function evidenceOf(row: unknown): Evidence[] {
  if (!isRow(row)) return []
  const ev = row.evidence
  if (Array.isArray(ev)) return ev.filter(isRow) as Evidence[]
  return isRow(ev) ? [ev as Evidence] : []
}

// 근거를 뺀 나머지 필드를 "이름: 값"으로 보여 준다
function fieldsOf(row: Row): [string, string][] {
  return Object.entries(row)
    .filter(([k]) => k !== 'evidence')
    .map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '–')])
}
</script>

<template>
  <div class="analysis">
    <section v-for="s in sections" :key="s.key">
      <h3>{{ s.title }}</h3>
      <ul v-if="s.items" class="items">
        <li v-for="(item, i) in s.items" :key="i">
          <dl v-if="isRow(item)">
            <template v-for="[k, v] in fieldsOf(item)" :key="k">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </template>
          </dl>
          <span v-else>{{ String(item) }}</span>
          <details v-if="evidenceOf(item).length" class="evidence">
            <summary>근거 {{ evidenceOf(item).length }}건</summary>
            <ul>
              <li v-for="(e, j) in evidenceOf(item)" :key="j">
                <b>{{ e.section ?? '–' }}</b> <span class="id num">{{ e.chunk_id }}</span>
                <p>{{ e.excerpt }}</p>
              </li>
            </ul>
          </details>
        </li>
        <li v-if="!s.items.length" class="muted">없음</li>
      </ul>
      <pre v-else class="json">{{ typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value) }}</pre>
    </section>
  </div>
</template>

<style scoped>
.analysis { display: flex; flex-direction: column; gap: 12px; }
h3 { margin: 0 0 6px; font-size: 14px; }
.items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.items > li { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; margin: 0; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
.evidence { margin-top: 6px; font-size: 12.5px; }
.evidence ul { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 6px; }
.evidence p { margin: 2px 0 0; color: var(--muted); }
.id { color: var(--muted); font-size: 11.5px; }
.muted { color: var(--muted); }
.json { background: var(--bg); border-radius: 8px; padding: 10px; font-size: 12px; overflow-x: auto; margin: 0; }
</style>
