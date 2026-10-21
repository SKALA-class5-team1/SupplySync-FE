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
  rfq_id: number | string
  rfq_number: string
  task_id: string
  status: string
}

// RFQ 목록 항목 (BE RfqDto.Summary)
export interface RfqSummary {
  rfq_id: number | string
  rfq_number: string
  customer_company?: string
  item?: string
  status: RfqStatus
  received_at?: string
}

// RFQ 상세 (BE RfqDto.Detail). latest_task_id가 가장 최근 분석 작업이다.
export interface RfqDetail extends RfqSummary {
  customer_company_id?: number
  eau?: number | null
  sample_qty?: number | null
  sample_due_date?: string | null
  sop_date?: string | null
  target_price_krw?: number | null
  quote_due_date?: string | null
  latest_task_id?: string | null
}

// ----- 분석 결과 (review / quotes). BE ReviewParts / QuoteParts / QuoteViews 기준 -----
export interface Evidence {
  chunk_id: string
  section?: string
  excerpt?: string
}

export interface Issue {
  id?: string
  type?: string // 이상값 | 누락 | 계약 리스크
  field?: string
  severity: 'HIGH' | 'MED' | 'LOW' | string
  found?: string
  reason?: string
  suggestion?: string
  ref?: string
  evidence?: Evidence[]
}

export interface Assumption {
  field: string
  value: string
  approved_by?: string
}

export interface ContractRisk {
  item: string
  limit?: string
  ref?: string
  evidence?: Evidence[]
}

export interface Shortage {
  part_id: string
  part_name?: string
  required_qty?: number
  available?: number
  short_qty?: number
  incoming_qty?: number
  incoming_date?: string
  incoming_delay_days?: number
  lead_time_days?: number
  is_critical?: boolean
}

export type AlternativeType = 'WAIT_INCOMING' | 'PARTIAL_DELIVERY' | 'SUBSTITUTE_PART' | 'NEW_ORDER'

export interface Alternative {
  type: AlternativeType | string
  label?: string
  target_part_id?: string
  covered_qty?: number
  available_date?: string
  meets_due_date?: boolean
  delay_days?: number
  extra_cost_krw?: number
  feasible?: boolean
  recommended?: boolean
  reason?: string
  refs?: string[]
  on_time_qty?: number
  late_qty?: number
  substitute_part_id?: string
  substitute_supplier?: string
  validation_days?: number
  unit_cost_diff_krw?: number
  lead_time_days?: number
  evidence?: Evidence[]
}

export interface Review {
  issues: Issue[]
  assumptions: Assumption[]
  customer_questions: string[]
  contract_risks: ContractRisk[]
  shortages: Shortage[]
  alternatives: Alternative[]
  [key: string]: unknown
}

export interface PriceByYear {
  year: number
  cr_applied?: number
  unit_price_krw: number
  margin_pct?: number // 담당자 전용
}

export interface QuoteCondition {
  type?: string // ASSUMPTION | SUBSTITUTE_PART | CONTRACT_PROPOSAL
  field?: string
  text: string
  part_id?: string
  qty?: number
  extra_cost_krw?: number
  ref?: string
}

export interface QuoteCheck {
  rule: string
  label?: string
  criterion?: string
  value?: string
  result: 'PASS' | 'FAIL' | string
  ref?: string
}

// 고객용(CustomerQuote)과 담당자용(ManagerQuote)을 한 타입으로 받는다. 내부 필드는 담당자 응답에만 있다.
export interface QuoteSummary {
  quote_id: string
  rfq_number?: string
  model_id?: string
  options?: string[]
  unit_price_krw?: number
  parts_cost_krw?: number // 담당자 전용
  margin_pct?: number // 담당자 전용
  price_by_year?: PriceByYear[]
  sample_qty?: number
  sample_due_date?: string
  valid_until?: string
  conditions?: QuoteCondition[]
  checks?: QuoteCheck[] // 담당자 전용
  status: QuoteStatus
  reject_reason?: string
  issue_date?: string
  details?: {
    recipient?: string
    incoterms?: string
    price_breakdown?: { code: string; amount_krw: number }[]
    parts_cost_breakdown?: { part_id: string; cost_krw: number }[] // 담당자 전용
  }
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
