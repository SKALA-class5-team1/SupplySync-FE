import { request } from './client'

// 요구 확인 (담당자 전용)
export function submitConfirmation(taskId: string, assumptions: { field: string; value: string }[]): Promise<void> {
  return request<void>('POST', `/api/ai/tasks/${encodeURIComponent(taskId)}/confirmation`, { assumptions })
}

export type ApprovalDecision = 'APPROVED' | 'REJECTED'

export interface ApprovalRequest {
  quote_id: string
  decision: ApprovalDecision
  reason?: string // 반려 시 필수
  return_to_step?: string
}

// 승인/반려 (담당자 전용, 202). 더블 클릭이나 이미 처리된 견적은 409 CONFLICT_STATE
export function submitApproval(taskId: string, body: ApprovalRequest): Promise<void> {
  return request<void>('POST', `/api/ai/tasks/${encodeURIComponent(taskId)}/approval`, body)
}
