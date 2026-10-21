<script setup lang="ts">
import { ref } from 'vue'
import { submitApproval, type ApprovalDecision } from '../api/ai'
import { ApiError } from '../api/client'
import { errorMessage } from '../labels'

// 담당자 승인 카드: 승인 / 수정 요청(REVISE) / 최종 반려(REJECTED). 수정 요청·반려는 사유 필수.
const props = defineProps<{ taskId: string; quoteId: string }>()
const emit = defineEmits<{ done: [decision: ApprovalDecision]; conflict: [] }>()

const reason = ref('')
const busy = ref(false)
const notice = ref('')

const DECISION_NOTICE: Record<ApprovalDecision, string> = {
  APPROVED: '승인을 접수했습니다.',
  REJECTED: '반려를 접수했습니다. 이 견적은 최종 반려되어 작업이 종료됩니다.',
  REVISE: '수정 요청을 접수했습니다. 견적이 다시 작성됩니다.',
}

async function decide(decision: ApprovalDecision) {
  const text = reason.value.trim()
  if (decision !== 'APPROVED' && !text) {
    notice.value = decision === 'REJECTED' ? '반려하려면 사유를 입력해 주세요.' : '수정을 요청하려면 사유를 입력해 주세요.'
    return
  }
  if (busy.value) return // 더블 클릭 방지
  busy.value = true
  notice.value = ''
  try {
    await submitApproval(props.taskId, {
      quote_id: props.quoteId,
      decision,
      ...(decision !== 'APPROVED' ? { reason: text } : {}),
    })
    notice.value = DECISION_NOTICE[decision]
    reason.value = ''
    emit('done', decision)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      notice.value = errorMessage('CONFLICT_STATE', '')
      emit('conflict')
    } else {
      notice.value = err instanceof ApiError ? errorMessage(err.code, '처리하지 못했습니다.') : '처리하지 못했습니다.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="actions">
    <input v-model="reason" placeholder="사유 (수정 요청·반려 시 필수)" />
    <button class="btn" :disabled="busy" @click="decide('APPROVED')">승인</button>
    <button class="btn ghost" :disabled="busy" @click="decide('REVISE')">수정 요청</button>
    <button class="btn ghost danger" :disabled="busy" @click="decide('REJECTED')">최종 반려</button>
    <p class="hint">수정 요청은 견적을 다시 작성하며 최대 3회까지 가능합니다. 최종 반려는 작업을 종료합니다.</p>
    <p v-if="notice" class="msg" role="status">{{ notice }}</p>
  </div>
</template>

<style scoped>
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.actions input { flex: 1 1 200px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 8px 10px; font: inherit; }
.btn { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
.btn.ghost.danger { color: var(--err); border-color: var(--err); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.hint, .msg { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--muted); }
.msg { color: var(--ink); font-size: 13px; }
</style>
