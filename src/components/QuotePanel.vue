<script setup lang="ts">
import { computed, ref } from 'vue'
import { submitApproval } from '../api/ai'
import { ApiError } from '../api/client'
import { errorMessage, label, QUOTE_LABEL, quoteChip, won } from '../labels'
import { notify } from '../toast'
import StatusChip from './StatusChip.vue'
import type { QuoteSummary } from '../api/types'

const props = defineProps<{ quotes: QuoteSummary[]; manager: boolean; taskId: string }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

// 승인·반려는 두 번 눌러 확인한다 (더블 클릭 방지)
const pending = ref<{ id: string; decision: 'APPROVED' | 'REJECTED' | 'REVISE' } | null>(null)
const reason = ref('')
const busy = ref('')

const canAct = computed(() => props.manager && !!props.taskId)

async function confirmDecision(q: QuoteSummary) {
  if (!pending.value) return
  const decision = pending.value.decision
  if (decision !== 'APPROVED' && !reason.value.trim()) {
    notify('반려나 수정 요청은 사유를 입력해 주세요.', 'err')
    return
  }
  busy.value = q.quote_id
  try {
    await submitApproval(props.taskId, {
      quote_id: q.quote_id,
      decision,
      ...(decision !== 'APPROVED' ? { reason: reason.value.trim() } : {}),
    })
    notify(decision === 'APPROVED' ? '견적을 승인했습니다.' : decision === 'REVISE' ? '수정을 요청했습니다.' : '견적을 반려했습니다.', 'ok')
    pending.value = null
    emit('changed')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      notify(errorMessage('CONFLICT_STATE', ''), 'err')
      emit('changed')
    } else {
      notify(err instanceof ApiError ? errorMessage(err.code, '처리하지 못했습니다.') : '처리하지 못했습니다.', 'err')
    }
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="quotes-list">
    <div v-if="!quotes.length" class="empty">
      <b>{{ manager ? '아직 견적이 없습니다' : '담당자가 견적을 검토 중입니다' }}</b>
      <p class="small" style="margin-top:6px">{{ manager ? '검토가 끝나면 견적이 여기에 나타납니다.' : '등록이 끝나면 단가와 조건을 이 화면에서 확인할 수 있습니다.' }}</p>
    </div>

    <article v-for="q in quotes" :key="q.quote_id" class="card stack">
      <div class="spread">
        <div>
          <div class="small muted num">{{ q.quote_id }}</div>
          <h2>{{ q.config ?? '견적' }}</h2>
        </div>
        <StatusChip :label="label(QUOTE_LABEL, q.status)" :cls="quoteChip(q.status)" />
      </div>

      <div class="price">
        <span class="small muted">단가 (1년차)</span>
        <b class="num">{{ won(q.unit_price_krw) }}</b>
        <span class="small muted">/ 개</span>
      </div>

      <dl class="kv">
        <div><dt>납기</dt><dd class="num">{{ q.delivery_weeks != null ? `${q.delivery_weeks}주` : '–' }}</dd></div>
        <div><dt>유효기간</dt><dd class="num">{{ q.valid_until ?? '–' }}</dd></div>
      </dl>

      <div v-if="q.yearly_prices?.length">
        <h3 class="small" style="margin-bottom:8px">연도별 단가 <span class="muted">· 연 3% 인하 기준</span></h3>
        <div class="tw">
          <table>
            <thead><tr><th v-for="y in q.yearly_prices" :key="y.year" class="r">{{ y.year }}년차</th></tr></thead>
            <tbody><tr><td v-for="y in q.yearly_prices" :key="y.year" class="r num">{{ won(y.unit_price_krw) }}</td></tr></tbody>
          </table>
        </div>
      </div>

      <div v-if="q.conditions?.length">
        <h3 class="small" style="margin-bottom:8px">조건</h3>
        <ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
          <li v-for="(c, i) in q.conditions" :key="i">{{ c }}</li>
        </ul>
      </div>

      <!-- 원가와 마진은 담당자에게만 보인다 -->
      <div v-if="manager && q.cost_breakdown?.length" class="internal">
        <h3 class="small" style="margin-bottom:8px">원가 구성 <span class="muted">· 고객에게 보이지 않음</span></h3>
        <dl class="cost">
          <div v-for="c in q.cost_breakdown" :key="c.label"><dt>{{ c.label }}</dt><dd class="num">{{ won(c.amount_krw) }}</dd></div>
          <div v-if="q.margin_pct != null"><dt>마진</dt><dd class="num">{{ q.margin_pct.toFixed(1) }}%</dd></div>
        </dl>
      </div>

      <!-- 담당자 승인 · 반려 (검토 대기 견적만) -->
      <div v-if="canAct && q.status === 'DRAFT'" class="actions" style="justify-content:flex-end">
        <template v-if="pending && pending.id === q.quote_id">
          <div v-if="pending.decision !== 'APPROVED'" class="field" style="width:100%">
            <label class="small muted" :for="`reason-${q.quote_id}`">{{ pending.decision === 'REVISE' ? '수정 요청 내용 (필수)' : '반려 사유 (필수)' }}</label>
            <textarea :id="`reason-${q.quote_id}`" v-model="reason" class="input" placeholder="예: 대체 칩 검증 일정이 맞지 않습니다"></textarea>
          </div>
          <p class="small" style="width:100%">
            {{ pending.decision === 'APPROVED' ? '이 견적을 승인할까요? 승인 후에는 고객에게 발송됩니다.' : pending.decision === 'REVISE' ? '담당자 수정 요청을 보낼까요? 요청 내용은 검토 단계로 돌아갑니다.' : '이 견적을 반려할까요?' }}
          </p>
          <button class="btn" :disabled="!!busy" @click="pending = null">취소</button>
          <button
            class="btn"
            :class="pending.decision === 'APPROVED' ? 'primary' : 'danger'"
            :disabled="!!busy"
            @click="confirmDecision(q)"
          >{{ busy ? '처리 중…' : pending.decision === 'APPROVED' ? '승인 확정' : pending.decision === 'REVISE' ? '수정 요청 확정' : '반려 확정' }}</button>
        </template>
        <template v-else>
          <button class="btn" :disabled="!!busy" @click="pending = { id: q.quote_id, decision: 'REVISE' }; reason = ''">수정 요청</button>
          <button class="btn danger" :disabled="!!busy" @click="pending = { id: q.quote_id, decision: 'REJECTED' }; reason = ''">반려</button>
          <button class="btn primary" :disabled="!!busy" @click="pending = { id: q.quote_id, decision: 'APPROVED' }; reason = ''">승인</button>
        </template>
      </div>
      <p v-else-if="manager && q.status === 'DRAFT' && !taskId" class="small muted">작업 정보가 없어 승인할 수 없습니다.</p>
    </article>
  </div>
</template>

<style scoped>
.price { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.price b { font-size: 28px; font-weight: 800; color: var(--accent); }
.actions textarea { min-height: 70px; }
</style>
