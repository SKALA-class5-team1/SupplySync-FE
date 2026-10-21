<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listRfqs } from '../api/rfq'
import { isManager } from '../session'
import { label, RFQ_LABEL } from '../labels'
import type { RfqSummary } from '../api/types'

const rows = ref<RfqSummary[]>([])
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    rows.value = await listRfqs()
  } catch {
    error.value = '목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="card">
    <div class="head">
      <div>
        <h1>{{ isManager() ? 'RFQ 목록 (담당자)' : 'RFQ 목록' }}</h1>
        <p class="muted">{{ isManager() ? '전체 RFQ를 검토하고 승인합니다.' : '우리 회사 RFQ 진행 현황입니다.' }}</p>
      </div>
      <RouterLink v-if="!isManager()" class="btn" to="/rfqs/new">RFQ 등록</RouterLink>
    </div>
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="muted">불러오는 중…</p>
    <p v-else-if="!rows.length" class="muted">등록된 RFQ가 없습니다.</p>
    <div v-else class="tw">
      <table>
        <thead><tr><th>RFQ 번호</th><th>상태</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.rfq_id">
            <td class="num">{{ r.rfq_number ?? r.rfq_id }}</td>
            <td>{{ label(RFQ_LABEL, r.status) }}</td>
            <td><RouterLink :to="`/rfqs/${r.rfq_id}`">상세</RouterLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
h1 { margin: 0; font-size: 22px; }
.muted { color: var(--muted); margin: 4px 0 0; font-size: 13px; }
.err { color: var(--err); }
.btn { background: var(--accent); color: var(--accent-ink); border-radius: 8px; padding: 8px 14px; font-weight: 600; text-decoration: none; }
.tw { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 9px 11px; text-align: left; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-size: 12.5px; }
</style>
