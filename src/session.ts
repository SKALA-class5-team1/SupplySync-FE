import { reactive } from 'vue'
import type { SessionUser } from './api/types'

// 로그인 토큰과 사용자 정보는 이 브라우저에만 둔다 (새로고침 후에도 유지)
const KEY = 'supplysync.session'

interface Session {
  token: string | null
  user: SessionUser | null
  expiresAt: number | null // epoch ms, 서버 expires_in 기준
}

function load(): Session {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.token === 'string') return v as Session
  } catch {
    // 저장소를 읽지 못하면 로그인 상태 없이 시작한다
  }
  return { token: null, user: null, expiresAt: null }
}

export const session = reactive<Session>(load())

export function saveSession(token: string | null, user: SessionUser | null, expiresIn?: number) {
  session.token = token
  session.user = user
  session.expiresAt = token && expiresIn ? Date.now() + expiresIn * 1000 : session.expiresAt
  if (!token) session.expiresAt = null
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, user, expiresAt: session.expiresAt }))
  } catch {
    // 저장이 막혀 있으면 이 탭 안에서만 유지된다
  }
}

// 만료되었으면 로그인 상태를 비우고 true를 돌려준다
export function expireIfNeeded(): boolean {
  if (session.token && session.expiresAt && Date.now() >= session.expiresAt) {
    saveSession(null, null)
    return true
  }
  return false
}

export const isManager = () => session.user?.user_type === 'MANAGER'
