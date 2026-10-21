// 개발용 목 데이터. 백엔드 없이 화면을 확인하려고 쓴다 (.env.development의 VITE_MOCK=true).
// 명세의 데모 시나리오 값(한별모터스 RFQ, 37,300원, 제어칩 500개 부족, 대체칩 추천)을 따른다.
// 응답 내부 필드명은 명세 미확정이므로 실제 백엔드 응답과 다를 수 있다.
import type { SessionUser, AnalysisResponse, QuoteSummary, RfqSummary, TaskStatus } from '../api/types'
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

interface MockRfq extends RfqSummary {
  company_id: number
  created_by: number
}

let rfqs: MockRfq[] = [
  { rfq_id: 'rfq-001', rfq_number: 'HB-EV7-EWP-001', title: '전동식 워터펌프 (EWP, 12V)', status: 'IN_REVIEW', task_id: 'task-001', created_at: '2026-10-12', company_id: 1, created_by: 1 },
  { rfq_id: 'rfq-002', rfq_number: 'HB-EV6-COOL-004', title: '배터리 냉각 밸브 (12V)', status: 'QUOTED', task_id: 'task-002', created_at: '2026-09-28', company_id: 1, created_by: 1 },
]

const taskStatus: Record<string, TaskStatus> = { 'task-001': 'WAITING_APPROVAL', 'task-002': 'DONE' }

// 데모 분석 결과 (rfq-001). 고온 옵션 + 방수 옵션 조합, 37,300원
function demoAnalysis(): AnalysisResponse {
  return {
    review: {
      issues: [
        { severity: 'HIGH', title: '유량 단위 오기 의심', detail: '22 L/h는 0.37 L/min으로 환산되어 시간당 표기일 가능성이 높습니다.', assumption: '22 L/min으로 가정' },
        { severity: 'MEDIUM', title: '커넥터 미정', detail: '커넥터가 TBD로 적혀 있습니다.', assumption: '표준 4핀으로 가정' },
        { severity: 'MEDIUM', title: '냉각수 미기재', detail: '요청서에 냉각수 항목이 없습니다.', assumption: '에틸렌글리콜 50%로 가정' },
        { severity: 'MEDIUM', title: '총 공급 물량 불일치', detail: '120,000 × 6년 = 720,000개인데 요청서에는 900,000개로 적혀 있습니다.' },
        { severity: 'MEDIUM', title: 'PPAP 일정', detail: 'PPAP 2027-10-15가 SOP 2027-09-01보다 늦습니다.' },
        { severity: 'MEDIUM', title: '품질 보증 기간 초과', detail: '5년 / 150,000 km는 사내 한도 3년 / 100,000 km를 넘습니다.' },
        { severity: 'MEDIUM', title: '지연 배상 상한 없음', detail: '사내 한도는 계약금액의 10%입니다.' },
      ],
      assumptions: [
        { field: 'flow', value: '22 L/min' },
        { field: 'connector', value: '4핀 표준' },
        { field: 'coolant', value: '에틸렌글리콜 50%' },
      ],
      customer_questions: [
        '유량 단위가 L/min이 맞는지 확인 부탁드립니다. (요청서 표기: 22 L/h)',
        '커넥터 사양(핀 수, 형상)을 알려 주세요.',
        '사용 냉각수 종류를 알려 주세요.',
        '총 공급 물량 900,000개와 120,000개 × 6년(720,000개)이 다릅니다. 어느 쪽이 맞는지 확인 부탁드립니다.',
        'PPAP 완료일(2027-10-15)이 양산 시작일(2027-09-01)보다 늦습니다. 일정을 확인 부탁드립니다.',
      ],
      contract_risks: [
        { clause: '제12조 품질 보증', summary: '5년 / 150,000 km 요구, 사내 한도 초과', limit: '3년 / 100,000 km' },
        { clause: '제13조 지연 배상', summary: '배상 상한 없음', limit: '계약금액의 10%' },
      ],
      shortages: [
        { part_id: 'P-MCU-G1', part_name: '제어칩 (고온용)', required: 2000, available: 1500, shortfall: 500, eta: '2027-01-20' },
      ],
      alternatives: [
        { alt_id: 'A', title: '입고 대기', summary: '입고 후 생산. 시작품 납기 불가', extra_cost_krw: 0, lead_days: 36, risk: '납기 지연' },
        { alt_id: 'B', title: '분할 납품', summary: '1,500개 먼저, 500개는 입고 후', extra_cost_krw: 0, lead_days: 36, risk: '배상 상한 없는 조항과 충돌' },
        { alt_id: 'C', title: '대체 칩 500개 적용', summary: 'P-MCU-G1-ALT, 검증 2주 후 생산', recommended: true, extra_cost_krw: 150000, lead_days: 14, risk: '검증 시험 필요' },
        { alt_id: 'D', title: '신규 발주', summary: '조달 120일', extra_cost_krw: 0, lead_days: 120, risk: '납기 불가' },
      ],
      proposal_summary: 'EWP-12-B + 고온 옵션(OPT-HT) + 방수 옵션(OPT-IP9K), 단가 37,300원. 시작품 500개에 대체 칩 적용.',
    },
    quotes: [
      {
        quote_id: 'q-101', status: 'DRAFT', config: 'EWP-12-B + OPT-HT + OPT-IP9K',
        unit_price_krw: 37300,
        yearly_prices: [1, 2, 3, 4, 5, 6].map((y) => ({ year: y, unit_price_krw: Math.round(37300 * Math.pow(0.97, y - 1)) })),
        delivery_weeks: 8, valid_until: '2026-11-18',
        conditions: ['시작품 500개에 대체 칩 적용', '보증 3년 / 100,000 km로 수정 제안', '지연 배상 상한 계약금액 10%'],
        cost_breakdown: [{ label: '기본 모델 EWP-12-B', amount_krw: 34000 }, { label: 'OPT-HT', amount_krw: 2400 }, { label: 'OPT-IP9K', amount_krw: 900 }],
        margin_pct: 42.0,
      },
    ],
  }
}

function demoAnalysisRfq2(): AnalysisResponse {
  return {
    review: { issues: [], assumptions: [], customer_questions: [], contract_risks: [], shortages: [], alternatives: [], proposal_summary: '' },
    quotes: [
      {
        quote_id: 'q-201', status: 'REGISTERED', config: 'COOL-VALVE-12V 기본',
        unit_price_krw: 21800,
        yearly_prices: [1, 2, 3].map((y) => ({ year: y, unit_price_krw: Math.round(21800 * Math.pow(0.97, y - 1)) })),
        delivery_weeks: 6, valid_until: '2026-10-30', conditions: ['결제 월말 마감 익월 60일', '단종 통지 12개월 전'],
      },
    ],
  }
}

const analyses: Record<string, AnalysisResponse> = { 'rfq-001': demoAnalysis(), 'rfq-002': demoAnalysisRfq2() }

function visibleRfqs(user: SessionUser): MockRfq[] {
  return user.user_type === 'MANAGER' ? rfqs : rfqs.filter((r) => r.company_id === user.company_id)
}

function findRfq(user: SessionUser, id: string): MockRfq | null {
  return visibleRfqs(user).find((r) => r.rfq_id === id) ?? null
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
      rfq_id: `rfq-${String(n).padStart(3, '0')}`, rfq_number: number, title: file.name.replace(/\.md$/i, ''),
      status: 'RECEIVED', task_id: `task-${String(n).padStart(3, '0')}`, created_at: new Date().toISOString().slice(0, 10),
      company_id: me.company_id, created_by: me.user_id,
    }
    rfqs = [rec, ...rfqs]
    taskStatus[rec.task_id!] = 'QUEUED'
    analyses[rec.rfq_id] = demoAnalysis()
    return ok({ rfq_id: rec.rfq_id, rfq_number: number, task_id: rec.task_id, status: 'RECEIVED' }, 202)
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
    const rfq = rfqs.find((r) => r.task_id === taskId)
    if (!rfq || !findRfq(me, rfq.rfq_id)) return err(404, 'NOT_FOUND', '찾을 수 없거나 볼 권한이 없습니다.')
    if (!sub && method === 'GET') return ok({ task_id: taskId, status: taskStatus[taskId] ?? 'DONE', current_step: taskStatus[taskId] === 'DONE' ? null : 'QUOTE', failure_reason: null, trace_url: null })
    if (me.user_type !== 'MANAGER') return err(403, 'FORBIDDEN', '이 화면은 담당자만 사용할 수 있습니다.')
    if (sub === '/confirmation' && method === 'POST') return ok({}, 200)
    if (sub === '/approval' && method === 'POST') {
      const b = body as { quote_id: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }
      const quote = analyses[rfq.rfq_id]?.quotes.find((x) => x.quote_id === b.quote_id)
      if (!quote) return err(404, 'NOT_FOUND', '견적을 찾을 수 없습니다.')
      if (quote.status !== 'DRAFT') return err(409, 'CONFLICT_STATE', '이미 처리되었습니다.')
      if (b.decision === 'REJECTED' && !b.reason?.trim()) return err(400, 'VALIDATION_ERROR', '반려 사유를 입력해 주세요.')
      quote.status = b.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
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
  { event: 'DONE', data: {}, wait: 0 },
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
    if (isManager || ['STEP_START', 'STEP_END', 'DONE', 'FAILED'].includes(item.event)) {
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
