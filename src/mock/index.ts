// 개발용 목 데이터. 백엔드 없이 화면을 확인하려고 쓴다 (.env.development의 VITE_MOCK=true).
// 명세의 데모 시나리오 값(한별모터스 RFQ, 37,300원, 제어칩 500개 부족, 대체칩 추천)을 따른다.
// 응답 필드명은 BE DTO(snake_case) 기준이다: RfqDto, ReviewParts, QuoteViews.
import type { SessionUser, AnalysisResponse, QuoteSummary, RfqDetail, TaskStatus } from '../api/types'
import type { TaskEvent } from '../api/task'

export const mockEnabled = () => import.meta.env.VITE_MOCK === 'true'

interface Raw { status: number; json: unknown }

const err = (status: number, code: string, message: string): Raw => ({
  status,
  json: { code, message, details: [], timestamp: new Date().toISOString() },
})
const ok = (json: unknown, status = 200): Raw => ({ status, json })

const USERS: Record<string, SessionUser & { password: string }> = {
  hb_buyer01: { user_id: 1, login_id: 'hb_buyer01', name: '박구매', user_type: 'CUSTOMER', company_id: 1, company_name: '한별모터스', password: 'demo1234' },
  ds_sales01: { user_id: 2, login_id: 'ds_sales01', name: '김영업', user_type: 'MANAGER', company_id: 2, company_name: '대성오토텍', password: 'demo1234' },
}

interface MockRfq extends RfqDetail {
  company_id: number
  created_by: number
}

let rfqs: MockRfq[] = [
  { rfq_id: 1, rfq_number: 'HB-EV7-EWP-001', customer_company: '한별모터스', item: '전동식 워터펌프 (EWP, 12V)', status: 'IN_REVIEW', received_at: '2026-10-12T09:00:00', latest_task_id: 'task-001', company_id: 1, created_by: 1 },
  { rfq_id: 2, rfq_number: 'HB-EV6-COOL-004', customer_company: '한별모터스', item: '배터리 냉각 밸브 (12V)', status: 'QUOTED', received_at: '2026-09-28T09:00:00', latest_task_id: 'task-002', company_id: 1, created_by: 1 },
]

const taskStatus: Record<string, TaskStatus> = { 'task-001': 'WAITING_APPROVAL', 'task-002': 'DONE' }

// 데모 분석 결과 (rfq-001). 고온 옵션 + 방수 옵션 조합, 37,300원
function demoAnalysis(): AnalysisResponse {
  const ev = [{ chunk_id: 'dsn-002', section: '2.1', excerpt: '전동식 워터펌프 유량 정상 범위는 5~60 L/min' }]
  return {
    review: {
      issues: [
        { id: 'ISS-01', type: '이상값', field: 'spec.flow', severity: 'HIGH', found: '22 L/h (= 0.37 L/min)', reason: '정상 범위 5~60 L/min을 크게 벗어남. 단위 오기 의심', suggestion: '22 L/min으로 가정', ref: 'design_standard.md §2', evidence: ev },
        { id: 'ISS-02', type: '누락', field: 'spec.connector', severity: 'MED', found: 'TBD', reason: '커넥터가 TBD로 적혀 있습니다.', suggestion: '표준 4핀으로 가정' },
        { id: 'ISS-03', type: '누락', field: 'spec.coolant', severity: 'MED', found: '미기재', reason: '요청서에 냉각수 항목이 없습니다.', suggestion: '에틸렌글리콜 50%로 가정' },
        { id: 'ISS-04', type: '계약 리스크', field: 'contract.warranty', severity: 'MED', found: '5년 / 150,000 km', reason: '사내 한도 3년 / 100,000 km 초과' },
      ],
      assumptions: [
        { field: 'spec.flow', value: '22 L/min' },
        { field: 'spec.connector', value: '4핀 표준' },
        { field: 'spec.coolant', value: '에틸렌글리콜 50%' },
      ],
      customer_questions: [
        '유량 단위가 L/min이 맞는지 확인 부탁드립니다. (요청서 표기: 22 L/h)',
        '커넥터 사양(핀 수, 형상)을 알려 주세요.',
        '사용 냉각수 종류를 알려 주세요.',
      ],
      contract_risks: [
        { item: '품질 보증 5년/150,000km', limit: '3년/100,000km', ref: '제12조' },
        { item: '지연 배상 상한 없음', limit: '계약금액의 10%', ref: '제13조' },
      ],
      shortages: [
        { part_id: 'P-MCU-G1', part_name: '제어칩 (고온용)', required_qty: 2000, available: 1500, short_qty: 500, incoming_qty: 5000, incoming_date: '2027-01-20', incoming_delay_days: 36, lead_time_days: 120, is_critical: true },
      ],
      alternatives: [
        { type: 'WAIT_INCOMING', label: '입고 대기', target_part_id: 'P-MCU-G1', meets_due_date: false, delay_days: 36, extra_cost_krw: 0, feasible: true, recommended: false, reason: '입고 후 생산. 시작품 납기 불가' },
        { type: 'PARTIAL_DELIVERY', label: '분할 납품', target_part_id: 'P-MCU-G1', meets_due_date: false, delay_days: 36, extra_cost_krw: 0, feasible: true, recommended: false, reason: '1,500개 먼저, 500개는 입고 후', on_time_qty: 1500, late_qty: 500 },
        { type: 'SUBSTITUTE_PART', label: '대체 부품 (타 공급처)', target_part_id: 'P-MCU-G1', covered_qty: 500, available_date: '2026-11-02', meets_due_date: true, delay_days: 0, extra_cost_krw: 150000, feasible: true, recommended: true, reason: '검증 2주 후 생산 가능', substitute_part_id: 'P-MCU-G1-ALT', substitute_supplier: '누리칩스', validation_days: 14, unit_cost_diff_krw: 300, refs: ['alt-002'] },
        { type: 'NEW_ORDER', label: '신규 발주', target_part_id: 'P-MCU-G1', meets_due_date: false, delay_days: 120, extra_cost_krw: 0, feasible: true, recommended: false, reason: '조달 120일', lead_time_days: 120 },
      ],
    },
    quotes: [
      {
        quote_id: 'Q-2026-1019-001', rfq_number: 'HB-EV7-EWP-001', model_id: 'EWP-12-B', options: ['OPT-HT', 'OPT-IP9K'],
        unit_price_krw: 37300, parts_cost_krw: 21650, margin_pct: 42.0,
        price_by_year: [1, 2, 3, 4, 5, 6].map((y) => ({ year: y, cr_applied: y - 1, unit_price_krw: Math.round(37300 * Math.pow(0.97, y - 1)), margin_pct: 42 - (y - 1) * 2 })),
        sample_qty: 2000, sample_due_date: '2026-12-15', valid_until: '2026-11-18',
        conditions: [
          { type: 'SUBSTITUTE_PART', text: '시작품 2,000개 중 500개에 대체 제어칩(누리칩스) 적용', part_id: 'P-MCU-G1-ALT', qty: 500, extra_cost_krw: 150000 },
          { type: 'CONTRACT_PROPOSAL', text: '보증 3년 / 100,000 km로 수정 제안', ref: '제12조' },
        ],
        checks: [
          { rule: 'MARGIN', label: '마진', criterion: '부품 원가 기준 30% 이상 (1년차·6년차)', value: '42.0% / 32.4%', result: 'PASS', ref: '제16조' },
        ],
        status: 'DRAFT', issue_date: '2026-10-19',
      },
    ],
  }
}

function demoAnalysisRfq2(): AnalysisResponse {
  return {
    review: { issues: [], assumptions: [], customer_questions: [], contract_risks: [], shortages: [], alternatives: [] },
    quotes: [
      {
        quote_id: 'Q-2026-0928-001', model_id: 'COOL-VALVE-12V', options: [], unit_price_krw: 21800,
        price_by_year: [1, 2, 3].map((y) => ({ year: y, unit_price_krw: Math.round(21800 * Math.pow(0.97, y - 1)) })),
        sample_qty: 500, sample_due_date: '2026-11-30', valid_until: '2026-10-30',
        conditions: [{ type: 'ASSUMPTION', text: '결제 월말 마감 익월 60일' }], status: 'REGISTERED',
      },
    ],
  }
}

const analyses: Record<string, AnalysisResponse> = { '1': demoAnalysis(), '2': demoAnalysisRfq2() }

function visibleRfqs(user: SessionUser): MockRfq[] {
  return user.user_type === 'MANAGER' ? rfqs : rfqs.filter((r) => r.company_id === user.company_id)
}

function findRfq(user: SessionUser, id: string): MockRfq | null {
  return visibleRfqs(user).find((r) => String(r.rfq_id) === id) ?? null
}

function userFromToken(token: string | null | undefined): SessionUser | null {
  if (!token?.startsWith('mock.')) return null
  const u = USERS[token.slice(5)]
  if (!u) return null
  const { password: _p, ...rest } = u
  return rest
}

export async function mockTransport(method: string, path: string, body: unknown, user: SessionUser | null): Promise<Raw> {
  await new Promise((r) => setTimeout(r, 220)) // 네트워크 지연 흉내
  const url = new URL(path, 'http://mock.local')
  const p = url.pathname
  const q = url.searchParams

  if (method === 'POST' && p === '/api/auth/login') {
    const b = body as { login_id?: string; password?: string }
    const u = USERS[b.login_id ?? '']
    if (!u || u.password !== b.password) return err(401, 'UNAUTHORIZED', '아이디 또는 비밀번호가 맞지 않습니다.')
    const { password: _p, ...rest } = u
    return ok({ access_token: `mock.${u.login_id}`, token_type: 'Bearer', expires_in: 3600, user: rest })
  }

  // 이하 인증 필요
  const me = user ?? userFromTokenFromSession()
  if (!me) return err(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

  if (method === 'GET' && p === '/api/me') return ok(me)

  if (method === 'GET' && p === '/api/rfqs') {
    let list = visibleRfqs(me)
    if (q.get('mine') === 'true') list = list.filter((r) => r.created_by === me.user_id)
    return ok(list.map(({ company_id: _c, created_by: _b, ...r }) => r))
  }

  if (method === 'POST' && p === '/api/rfqs') {
    if (me.user_type !== 'CUSTOMER') return err(403, 'FORBIDDEN', '이 화면은 담당자만 사용할 수 있습니다.')
    const form = body as FormData
    const file = form.get('file') as File | null
    const number = String(form.get('rfq_number') ?? '')
    if (!file || !number) return err(400, 'VALIDATION_ERROR', 'RFQ 번호와 요청서 파일을 확인해 주세요.')
    const n = rfqs.length + 1
    const rec: MockRfq = {
      rfq_id: n, rfq_number: number, customer_company: me.company_name, item: file.name.replace(/\.md$/i, ''),
      status: 'RECEIVED', latest_task_id: `task-${String(n).padStart(3, '0')}`, received_at: new Date().toISOString().slice(0, 19),
      company_id: me.company_id, created_by: me.user_id,
    }
    rfqs = [rec, ...rfqs]
    taskStatus[rec.latest_task_id!] = 'QUEUED'
    analyses[String(rec.rfq_id)] = demoAnalysis()
    return ok({ rfq_id: rec.rfq_id, rfq_number: number, task_id: rec.latest_task_id, status: 'QUEUED' }, 202)
  }

  const rfqMatch = p.match(/^\/api\/rfqs\/([^/]+)(\/analysis|\/quotes)?$/)
  if (method === 'GET' && rfqMatch) {
    const [, id, sub] = rfqMatch
    const rfq = findRfq(me, id)
    if (!rfq) return err(404, 'NOT_FOUND', '찾을 수 없거나 볼 권한이 없습니다.')
    if (!sub) return ok(stripInternal(rfq))
    if (sub === '/analysis') {
      if (me.user_type !== 'MANAGER') return err(403, 'FORBIDDEN', '이 화면은 담당자만 사용할 수 있습니다.')
      return ok(analyses[id] ?? { review: emptyReview(), quotes: [] })
    }
    // /quotes: 고객에게는 REGISTERED 견적만
    const all = analyses[id]?.quotes ?? []
    const list = me.user_type === 'MANAGER' ? all : all.filter((x: QuoteSummary) => x.status === 'REGISTERED')
    return ok(list)
  }

  const taskMatch = p.match(/^\/api\/ai\/tasks\/([^/]+)(\/confirmation|\/approval)?$/)
  if (taskMatch) {
    const [, taskId, sub] = taskMatch
    const rfq = rfqs.find((r) => r.latest_task_id === taskId)
    if (!rfq || !findRfq(me, String(rfq.rfq_id))) return err(404, 'NOT_FOUND', '찾을 수 없거나 볼 권한이 없습니다.')
    if (!sub && method === 'GET') return ok({ task_id: taskId, rfq_number: rfq.rfq_number, status: taskStatus[taskId] ?? 'DONE', current_step: taskStatus[taskId] === 'DONE' ? null : 'QUOTE', failure_reason: null, trace_url: null })
    if (me.user_type !== 'MANAGER') return err(403, 'FORBIDDEN', '이 화면은 담당자만 사용할 수 있습니다.')
    if (sub === '/confirmation' && method === 'POST') return ok({}, 200)
    if (sub === '/approval' && method === 'POST') {
      const b = body as { quote_id: string; decision: 'APPROVED' | 'REJECTED' | 'REVISE'; reason?: string }
      const quote = analyses[String(rfq.rfq_id)]?.quotes.find((x) => x.quote_id === b.quote_id)
      if (!quote) return err(404, 'NOT_FOUND', '견적을 찾을 수 없습니다.')
      if (quote.status !== 'DRAFT') return err(409, 'CONFLICT_STATE', '이미 처리되었습니다.')
      if (b.decision !== 'APPROVED' && !b.reason?.trim()) return err(400, 'VALIDATION_ERROR', '반려 사유를 입력해 주세요.')
      quote.status = b.decision === 'APPROVED' ? 'APPROVED' : b.decision === 'REJECTED' ? 'REJECTED' : 'DRAFT'
      return ok({}, 202)
    }
  }

  return err(404, 'NOT_FOUND', '지원하지 않는 요청입니다.')
}

function userFromTokenFromSession(): SessionUser | null {
  try {
    const v = JSON.parse(localStorage.getItem('supplysync.session') ?? 'null')
    return userFromToken(v?.token)
  } catch {
    return null
  }
}

function stripInternal(r: MockRfq) {
  const { company_id: _c, created_by: _b, ...rest } = r
  return rest
}

function emptyReview() {
  return { issues: [], assumptions: [], customer_questions: [], contract_risks: [], shortages: [], alternatives: [] }
}

// 진행 이벤트 흉내. 실제 SSE처럼 시간차를 두고 보낸다.
const SEQUENCE: { event: TaskEvent['event']; data: unknown; wait: number }[] = [
  { event: 'STEP_START', data: { step: 'RFQ_ANALYSIS' }, wait: 600 },
  { event: 'STEP_END', data: { step: 'RFQ_ANALYSIS' }, wait: 300 },
  { event: 'STEP_START', data: { step: 'SPEC_MATCH' }, wait: 600 },
  { event: 'TOOL_START', data: { tool: 'business.get_models' }, wait: 300 },
  { event: 'TOOL_END', data: { tool: 'business.get_models' }, wait: 300 },
  { event: 'CLARIFICATION_REQUIRED', data: { reason: '유량 단위 확인 필요' }, wait: 400 },
  { event: 'STEP_END', data: { step: 'SPEC_MATCH' }, wait: 300 },
  { event: 'STEP_START', data: { step: 'SUPPLY_CHECK' }, wait: 600 },
  { event: 'STEP_END', data: { step: 'SUPPLY_CHECK' }, wait: 300 },
  { event: 'STEP_START', data: { step: 'ALTERNATIVE_ANALYSIS' }, wait: 600 },
  { event: 'STEP_END', data: { step: 'ALTERNATIVE_ANALYSIS' }, wait: 300 },
  { event: 'STEP_START', data: { step: 'QUOTE' }, wait: 600 },
  { event: 'STEP_END', data: { step: 'QUOTE' }, wait: 300 },
  { event: 'APPROVAL_REQUIRED', data: { reason: '견적 승인 필요' }, wait: 400 },
  { event: 'RUN_END', data: { outcome: 'REGISTERED' }, wait: 0 },
]

export function mockStream(
  taskId: string,
  user: SessionUser | null,
  handlers: { onEvent: (e: TaskEvent) => void; onDisconnect: (r: 'terminal' | 'closed') => void },
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let i = 0
  const isManager = user?.user_type === 'MANAGER'
  const next = () => {
    if (stopped) return
    if (i >= SEQUENCE.length) {
      handlers.onDisconnect('terminal')
      return
    }
    const item = SEQUENCE[i++]
    // 고객에게는 STEP_*, DONE, FAILED만 보낸다
    if (isManager || ['STEP_START', 'STEP_END', 'DONE', 'RUN_END', 'FAILED'].includes(item.event)) {
      handlers.onEvent({ event: item.event, data: item.data })
    }
    timer = setTimeout(next, item.wait)
  }
  timer = setTimeout(next, 300)
  void taskId
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
