// 상태값 → 화면 문구. 백엔드 enum 기준이다.
export const TASK_LABEL: Record<string, string> = {
  QUEUED: '대기 중',
  RUNNING: '진행 중',
  NEEDS_CLARIFICATION: '요구 확인 필요',
  WAITING_APPROVAL: '승인 대기',
  REVALIDATING: '재검증 중',
  REGISTERING: '등록 중',
  ON_HOLD: '보류',
  DONE: '완료',
  FAILED: '실패',
}

export const QUOTE_LABEL: Record<string, string> = {
  DRAFT: '초안',
  APPROVED: '승인됨',
  REJECTED: '반려',
  REGISTERED: '등록됨',
}

export const RFQ_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  IN_REVIEW: '검토 중',
  QUOTED: '견적 완료',
}

// 진행 단계 (ALTERNATIVE_ANALYSIS는 부품이 부족할 때만 나온다)
export const STEP_ORDER = [
  'RFQ_ANALYSIS', 'SPEC_MATCH', 'SUPPLY_CHECK', 'ALTERNATIVE_ANALYSIS', 'QUOTE',
  'FINAL_REVIEW', 'APPROVAL', 'REVALIDATION', 'REGISTRATION',
] as const

export const STEP_LABEL: Record<string, string> = {
  RFQ_ANALYSIS: '요청서 분석',
  SPEC_MATCH: '사양 매칭',
  SUPPLY_CHECK: '공급 확인',
  ALTERNATIVE_ANALYSIS: '대안 분석',
  QUOTE: '견적 작성',
  FINAL_REVIEW: '최종 검토',
  APPROVAL: '승인',
  REVALIDATION: '재검증',
  REGISTRATION: '등록',
}

export const label = (map: Record<string, string>, key: string | undefined) =>
  key ? (map[key] ?? key) : '–'

// 오류 코드 → 안내 문구
export function errorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'VALIDATION_ERROR': return '입력값을 확인해 주세요.'
    case 'FORBIDDEN': return '이 화면은 담당자만 사용할 수 있습니다.'
    case 'NOT_FOUND': return '찾을 수 없거나 볼 권한이 없습니다.'
    case 'CONFLICT_STATE': return '이미 처리되었습니다. 새로고침해서 최신 상태를 확인해 주세요.'
    default: return fallback
  }
}
