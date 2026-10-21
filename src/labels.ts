// 상태값 → 화면 문구와 칩 클래스(아티팩트 스타일). 백엔드 enum 기준이다.

export const TASK_LABEL: Record<string, string> = {
  QUEUED: '대기 중', RUNNING: '진행 중', NEEDS_CLARIFICATION: '요구 확인 필요', WAITING_APPROVAL: '승인 대기',
  REVALIDATING: '재검증 중', REGISTERING: '등록 중', ON_HOLD: '보류', DONE: '완료', FAILED: '실패',
}
const TASK_CHIP: Record<string, string> = {
  QUEUED: 'submitted', RUNNING: 'quote', NEEDS_CLARIFICATION: 'confirm', WAITING_APPROVAL: 'approved',
  REVALIDATING: 'quote', REGISTERING: 'quote', ON_HOLD: 'submitted', DONE: 'accepted', FAILED: 'rejected',
}

// 작업 종료 결과 문구
export const OUTCOME_LABEL: Record<string, string> = {
  REGISTERED: '견적이 등록되었습니다.',
  REJECTED: '담당자가 견적을 반려하여 종료되었습니다.',
}

export const QUOTE_LABEL: Record<string, string> = {
  DRAFT: '검토 대기', APPROVED: '승인됨', REJECTED: '반려', REGISTERED: '등록됨',
}
const QUOTE_CHIP: Record<string, string> = { DRAFT: 'confirm', APPROVED: 'approved', REJECTED: 'rejected', REGISTERED: 'accepted' }

export const RFQ_LABEL: Record<string, string> = { RECEIVED: '접수', IN_REVIEW: '검토 중', QUOTED: '견적 완료' }
const RFQ_CHIP: Record<string, string> = { RECEIVED: 'submitted', IN_REVIEW: 'quote', QUOTED: 'accepted' }

// 진행 단계 순서 (ALTERNATIVE_ANALYSIS는 부품이 부족할 때만 나온다)
export const STEP_ORDER = [
  'RFQ_ANALYSIS', 'SPEC_MATCH', 'SUPPLY_CHECK', 'ALTERNATIVE_ANALYSIS', 'QUOTE',
  'FINAL_REVIEW', 'APPROVAL', 'REVALIDATION', 'REGISTRATION',
] as const

export const STEP_LABEL: Record<string, string> = {
  RFQ_ANALYSIS: '요청서 분석', SPEC_MATCH: '사양 매칭', SUPPLY_CHECK: '공급 확인',
  ALTERNATIVE_ANALYSIS: '대안 분석', QUOTE: '견적 작성', FINAL_REVIEW: '최종 검토',
  APPROVAL: '승인', REVALIDATION: '재검증', REGISTRATION: '등록',
}

export const SEVERITY_LABEL: Record<string, string> = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }

export const label = (map: Record<string, string>, key: string | undefined | null) => (key ? (map[key] ?? key) : '–')
export const taskChip = (s?: string) => TASK_CHIP[s ?? ''] ?? 'submitted'
export const quoteChip = (s?: string) => QUOTE_CHIP[s ?? ''] ?? 'submitted'
export const rfqChip = (s?: string) => RFQ_CHIP[s ?? ''] ?? 'submitted'
export const severityChip = (s?: string) => (s === 'HIGH' ? 'HIGH' : s === 'MEDIUM' ? 'MEDIUM' : 'LOW')

// 화면 전체 흐름 (접수 → 검토 → 견적 → 완료)
export function lifecycleIndex(rfqStatus?: string, hasDraft = false): number {
  if (rfqStatus === 'QUOTED') return 3
  if (hasDraft) return 2
  if (rfqStatus === 'IN_REVIEW') return 1
  return 0
}
export const LIFECYCLE = ['접수', '검토', '견적', '완료']

export const won = (n?: number | null) => (n == null ? '–' : `${Number(n).toLocaleString('ko-KR')}원`)

// 오류 코드 → 안내 문구
export function errorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'VALIDATION_ERROR': return '입력값을 확인해 주세요.'
    case 'UNAUTHORIZED': return '로그인이 필요합니다.'
    case 'FORBIDDEN': return '이 화면은 담당자만 사용할 수 있습니다.'
    case 'NOT_FOUND': return '찾을 수 없거나 볼 권한이 없습니다.'
    case 'CONFLICT_STATE': return '이미 처리되었습니다. 새로고침해서 최신 상태를 확인해 주세요.'
    default: return fallback
  }
}
