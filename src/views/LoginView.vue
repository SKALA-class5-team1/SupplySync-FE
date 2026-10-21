<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login, me } from '../api/auth'
import { ApiError } from '../api/client'
import { saveSession } from '../session'
import { notify } from '../toast'

const router = useRouter()
const route = useRoute()
const loginId = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

function fillDemo(id: string) {
  loginId.value = id
  password.value = 'demo1234'
}

async function submit() {
  if (!loginId.value.trim() || !password.value) {
    error.value = '아이디와 비밀번호를 입력해 주세요.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const res = await login(loginId.value.trim(), password.value)
    saveSession(res.access_token, res.user, res.expires_in)
    saveSession(res.access_token, await me(), res.expires_in)
    notify(`${res.user.name}님, 환영합니다.`, 'ok')
    await router.replace(String(route.query.next ?? '/rfqs'))
  } catch (err) {
    error.value = err instanceof ApiError && err.status === 401
      ? '아이디 또는 비밀번호가 맞지 않습니다.'
      : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <section class="intro">
      <span class="small" style="color:var(--slate);font-weight:700">RFQ 견적 회신</span>
      <h1>사양 검토, 재고 확인, 승인을<br>한 흐름으로</h1>
      <ul class="points small">
        <li>요청서 원문에서 이상값과 빠진 값을 자동으로 찾습니다.</li>
        <li>부족한 부품은 대체안을 비교하고 근거 문서를 함께 보여 줍니다.</li>
        <li>담당자 확인과 승인 지점에서만 사람이 멈춰 판단합니다.</li>
      </ul>
    </section>

    <section class="card stack">
      <h2>로그인</h2>
      <p class="muted small">예시 계정을 누르면 아이디와 비밀번호가 채워집니다.</p>
      <div class="demo" style="margin-top:0">
        <button type="button" class="btn block demo-btn" @click="fillDemo('hb_buyer01')">고객 예시 계정<br><span class="small muted">한별모터스 · hb_buyer01</span></button>
        <button type="button" class="btn block demo-btn" @click="fillDemo('ds_sales01')">담당자 예시 계정<br><span class="small muted">대성오토텍 · ds_sales01</span></button>
      </div>
      <form class="stack" @submit.prevent="submit">
        <div class="field"><label for="login-id">아이디</label><input id="login-id" v-model="loginId" class="input" autocomplete="username" /></div>
        <div class="field"><label for="login-pw">비밀번호</label><input id="login-pw" v-model="password" class="input" type="password" autocomplete="current-password" /></div>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <button class="btn primary block" :disabled="busy">{{ busy ? '확인 중…' : '로그인' }}</button>
      </form>
    </section>
  </div>
</template>
