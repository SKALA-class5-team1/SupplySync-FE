<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listRfqs } from '../api/rfq'
import { ApiError } from '../api/client'
import { session, isManager } from '../session'
import { errorMessage, label, RFQ_LABEL, rfqChip, LIFECYCLE } from '../labels'
import StatusChip from '../components/StatusChip.vue'
import Track from '../components/Track.vue'
import type { RfqSummary } from '../api/types'

const rows = ref<RfqSummary[]>([])
const error = ref('')
const loading = ref(true)

const counts = computed(() => ({
  total: rows.value.length,
  open: rows.value.filter((r) => r.status !== 'QUOTED').length,
  done: rows.value.filter((r) => r.status === 'QUOTED').length,
}))

onMounted(async () => {
  try {
    rows.value = await listRfqs()
  } catch (err) {
    error.value = err instanceof ApiError ? errorMessage(err.code, '목록을 불러오지 못했습니다.') : '목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>안녕하세요, {{ session.user?.name }}님</h1>
        <p>{{ isManager() ? '접수된 RFQ와 승인 대기 건을 확인하세요.' : `${session.user?.company_name}의 RFQ 진행 현황입니다.` }}</p>
      </div>
      <RouterLink v-if="!isManager()" class="btn primary" to="/rfqs/new">RFQ 등록</RouterLink>
    </div>

    <div class="grid3" style="margin-bottom:16px">
      <div class="stat card"><b class="num">{{ counts.total }}</b><span>전체 RFQ</span></div>
      <div class="stat card"><b class="num">{{ counts.open }}</b><span>진행 중</span></div>
      <div class="stat card"><b class="num">{{ counts.done }}</b><span>견적 완료</span></div>
    </div>

    <section class="card" style="margin-bottom:16px">
      <div class="card-title"><h2>최근 RFQ</h2><span class="sub">행을 누르면 상세로 이동합니다</span></div>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="muted small">불러오는 중…</p>
      <div v-else-if="!rows.length" class="empty">
        <b>등록된 RFQ가 없습니다</b>
        <p class="small" style="margin-top:6px">{{ isManager() ? '고객이 RFQ를 등록하면 여기에 나타납니다.' : '요청서(.md)를 올리면 검토가 시작됩니다.' }}</p>
      </div>
      <div v-else class="tw">
        <table>
          <thead><tr><th>RFQ 번호</th><th>품목</th><th>접수일</th><th>상태</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.rfq_id" class="click" @click="$router.push(`/rfqs/${r.rfq_id}`)">
              <td class="num">{{ r.rfq_number ?? r.rfq_id }}</td>
              <td>{{ r.title ?? '–' }}</td>
              <td class="num muted">{{ r.created_at ?? '–' }}</td>
              <td><StatusChip :label="label(RFQ_LABEL, r.status)" :cls="rfqChip(r.status)" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="card-title"><h2>진행 순서</h2><span class="sub">RFQ 한 건이 거치는 단계</span></div>
      <Track :items="LIFECYCLE" :index="0" />
    </section>
  </div>
</template>
