import { expireIfNeeded, saveSession, session } from '../session'
import { mockEnabled, mockTransport } from '../mock'
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

interface RawResponse {
  status: number
  json: unknown
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && 'code' in v && 'message' in v
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// 실제 네트워크 또는 개발용 목 데이터(VITE_MOCK=true)로 보낸다
async function transport(method: string, path: string, body?: unknown): Promise<RawResponse> {
  if (mockEnabled()) return mockTransport(method, path, body, session.user)
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method,
    headers: {
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, json: text ? safeJson(text) : null }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (expireIfNeeded() && path !== '/api/auth/login') {
    location.assign('/login')
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: '로그인이 만료되었습니다.', details: [], timestamp: new Date().toISOString() })
  }
  const { status, json } = await transport(method, path, body)
  if (status === 401 && path !== '/api/auth/login') {
    saveSession(null, null)
    if (location.pathname !== '/login') location.assign('/login')
  }
  if (status < 200 || status >= 300) throw new ApiError(status, isErrorBody(json) ? json : null)
  return json as T
}
