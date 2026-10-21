<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { session, saveSession, isManager } from './session'
import { toasts } from './toast'

const router = useRouter()
const route = useRoute()
const user = computed(() => session.user)
const onLogin = computed(() => route.path === '/login')

function logout() {
  saveSession(null, null)
  router.push('/login')
}
</script>

<template>
  <header v-if="!onLogin" class="top">
    <div class="top-in">
      <RouterLink class="brand" to="/rfqs"><i></i>SupplySync</RouterLink>
      <nav v-if="user" class="nav" aria-label="주 메뉴">
        <RouterLink to="/rfqs">메인</RouterLink>
        <RouterLink v-if="!isManager()" to="/rfqs/new">RFQ 등록</RouterLink>
      </nav>
      <div v-if="user" class="who">
        <span><b>{{ user.name }}</b> · {{ user.company_name }} · {{ isManager() ? '담당자' : '고객' }}</span>
        <button class="btn sm" @click="logout">로그아웃</button>
      </div>
    </div>
  </header>

  <main class="wrap" :style="onLogin ? 'padding-top:40px' : ''">
    <RouterView />
  </main>

  <footer v-if="!onLogin" class="wrap" style="padding-top:0">
    <p class="foot">데모 데이터: 가상의 회사와 수치입니다. 백엔드 연결 전에는 목 데이터로 동작합니다.</p>
  </footer>

  <div class="toasts" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast on" :class="t.kind">{{ t.text }}</div>
  </div>
</template>
