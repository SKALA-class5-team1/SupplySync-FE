// 백엔드 명세 기준 (JSON 필드명은 snake_case)
export type UserType = 'CUSTOMER' | 'MANAGER'

export interface SessionUser {
  user_id: number
  login_id: string
  name: string
  user_type: UserType
  company_id: number
  company_name: string
}

export type TaskStatus =
  | 'QUEUED' | 'RUNNING' | 'NEEDS_CLARIFICATION' | 'WAITING_APPROVAL' | 'REVALIDATING'
  | 'REGISTERING' | 'ON_HOLD' | 'DONE' | 'FAILED'

export type QuoteStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'REGISTERED'

export type RfqStatus = 'RECEIVED' | 'IN_REVIEW' | 'QUOTED' | string

export type StepName =
  | 'RFQ_ANALYSIS' | 'SPEC_MATCH' | 'SUPPLY_CHECK' | 'ALTERNATIVE_ANALYSIS' | 'QUOTE'
  | 'FINAL_REVIEW' | 'APPROVAL' | 'REVALIDATION' | 'REGISTRATION'

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: SessionUser
}

export interface CreateRfqResponse {
  rfq_id: string
  rfq_number: string
  task_id: string
  status: string
}

export interface RfqSummary {
  rfq_id: string
  rfq_number?: string
  status: RfqStatus
  [key: string]: unknown
}

// 승인 화면용 분석 결과. review 내부 필드는 Swagger 스키마 확인 후 좁힌다.
export interface AnalysisResponse {
  review: Record<string, unknown>
  quotes: QuoteSummary[]
}

export interface QuoteSummary {
  quote_id: string
  status: QuoteStatus
  [key: string]: unknown
}

export interface ApiErrorBody {
  code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT_STATE' | string
  message: string
  details: unknown[]
  timestamp: string
}
