import { expireIfNeeded, session, saveSession } from '../session'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get code(): string | undefined {
    return this.body?.code
  }
}

// 오류 응답: { code, message, details[], timestamp }
function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && 'code' in v && 'message' in v
}

// 로그인 후 보던 화면으로 돌아오도록 현재 주소를 next로 넘긴다
function loginUrl(): string {
  const here = location.pathname + location.search
  return here === '/' || here.startsWith('/login') ? '/login' : `/login?next=${encodeURIComponent(here)}`
}

export function authHeaders(): Record<string, string> {
  return session.token ? { Authorization: `Bearer ${session.token}` } : {}
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // 만료된 토큰은 요청 전에 걸러서 로그인 화면으로 보낸다
  if (expireIfNeeded() && path !== '/api/auth/login') {
    location.assign(loginUrl())
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: '로그인이 만료되었습니다.', details: [], timestamp: new Date().toISOString() })
  }
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method,
    headers: {
      ...authHeaders(),
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const text = await res.text()
  const json = text ? safeJson(text) : null
  if (res.status === 401 && path !== '/api/auth/login') {
    // 토큰이 잘못되었거나 만료되었다. 로그인 상태를 비우고 로그인 화면으로 보낸다.
    saveSession(null, null)
    if (location.pathname !== '/login') location.assign(loginUrl())
  }
  if (!res.ok) throw new ApiError(res.status, isErrorBody(json) ? json : null)
  return json as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
