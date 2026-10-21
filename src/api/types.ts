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

// 작업 종료 결과 (DONE 이벤트의 data.outcome). 반려(REJECTED)도 DONE으로 끝난다.
export type TaskOutcome = 'REGISTERED' | 'REJECTED'

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
  title?: string
  status: RfqStatus
  task_id?: string
  created_at?: string
  [key: string]: unknown
}

// ----- 분석 결과 (review / quotes) -----
// 명세에 항목은 있으나 내부 필드명은 아직 확정되지 않았다. 백엔드 확인 후 맞춘다.
export interface Issue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail: string
  assumption?: string
}

export interface Shortage {
  part_id: string
  part_name: string
  required: number
  available: number
  shortfall: number
  eta?: string
}

export interface Alternative {
  alt_id: string
  title: string
  summary: string
  recommended?: boolean
  extra_cost_krw?: number
  lead_days?: number
  risk?: string
}

export interface ContractRisk {
  clause: string
  summary: string
  limit?: string
}

export interface Review {
  issues: Issue[]
  assumptions: { field: string; value: string }[]
  customer_questions: string[]
  contract_risks: ContractRisk[]
  shortages: Shortage[]
  alternatives: Alternative[]
  proposal_summary?: string
}

export interface YearlyPrice {
  year: number
  unit_price_krw: number
}

export interface QuoteSummary {
  quote_id: string
  status: QuoteStatus
  config?: string
  unit_price_krw?: number
  yearly_prices?: YearlyPrice[]
  delivery_weeks?: number
  valid_until?: string
  conditions?: string[]
  cost_breakdown?: { label: string; amount_krw: number }[]
  margin_pct?: number
  [key: string]: unknown
}

export interface AnalysisResponse {
  review: Review
  quotes: QuoteSummary[]
}

export interface ApiErrorBody {
  code: 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT_STATE' | string
  message: string
  details: unknown[]
  timestamp: string
}
