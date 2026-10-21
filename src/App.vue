<script setup lang="ts">
import { useRouter } from 'vue-router'
import { session, saveSession, isManager } from './session'

const router = useRouter()

function logout() {
  saveSession(null, null)
  router.push('/login')
}
</script>

<template>
  <header class="top">
    <RouterLink class="brand" to="/rfqs">SupplySync</RouterLink>
    <div v-if="session.user" class="who">
      <span>{{ session.user.name }} · {{ session.user.company_name }} · {{ isManager() ? '담당자' : '고객' }}</span>
      <button class="link" @click="logout">로그아웃</button>
    </div>
  </header>
  <main class="wrap">
    <RouterView />
  </main>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--surface); border-bottom: 1px solid var(--line); padding: 12px 16px; }
.brand { font-weight: 700; color: var(--ink); text-decoration: none; }
.who { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); }
.link { background: none; border: 0; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }
.wrap { max-width: 960px; margin: 0 auto; padding: 20px 16px 40px; }
</style>
