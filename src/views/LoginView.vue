<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login, me } from '../api/auth'
import { ApiError } from '../api/client'
import { saveSession } from '../session'

const router = useRouter()
const route = useRoute()
const loginId = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const res = await login(loginId.value.trim(), password.value)
    saveSession(res.access_token, res.user, res.expires_in)
    // 역할과 회사 정보는 /api/me로 다시 확인한다
    saveSession(res.access_token, await me(), res.expires_in)
    await router.replace(String(route.query.next ?? '/rfqs'))
  } catch (err) {
    error.value = err instanceof ApiError && err.status === 401
      ? '아이디 또는 비밀번호가 맞지 않습니다.'
      : '로그인하지 못했습니다. 다시 시도해 주세요.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card narrow">
    <h1>로그인</h1>
    <p class="muted">데모 계정: <code>hb_buyer01</code>(고객) · <code>ds_sales01</code>(담당자), 비밀번호 <code>demo1234</code></p>
    <form class="stack" @submit.prevent="submit">
      <label class="field">아이디<input v-model="loginId" autocomplete="username" required /></label>
      <label class="field">비밀번호<input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <button class="btn" :disabled="busy">{{ busy ? '확인 중…' : '로그인' }}</button>
    </form>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.narrow { max-width: 420px; margin: 24px auto 0; }
h1 { margin: 0 0 6px; font-size: 22px; }
.muted { color: var(--muted); font-size: 13px; }
.stack { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
input { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 9px 11px; font: inherit; }
.btn { align-self: flex-start; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.err { color: var(--err); margin: 0; }
</style>
