import { request } from './client'
import type { LoginResponse, SessionUser } from './types'

// 현재 로그인은 스텁이다 (아무 입력이나 통과). 응답 형식은 확정이다.
export function login(loginId: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('POST', '/api/auth/login', { login_id: loginId, password })
}

export function me(): Promise<SessionUser> {
  return request<SessionUser>('GET', '/api/me')
}
