import { request } from './client'
import type { AnalysisResponse, CreateRfqResponse, QuoteSummary, RfqDetail, RfqSummary } from './types'

// RFQ 접수: multipart (file: .md, rfq_number). 202 응답.
export function createRfq(file: File, rfqNumber: string): Promise<CreateRfqResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('rfq_number', rfqNumber)
  return request<CreateRfqResponse>('POST', '/api/rfqs', form)
}

// 고객은 자기 회사 것만, 담당자는 전체
export function listRfqs(): Promise<RfqSummary[]> {
  return request<RfqSummary[]>('GET', '/api/rfqs')
}

export function getRfq(rfqId: string | number): Promise<RfqDetail> {
  return request<RfqDetail>('GET', `/api/rfqs/${encodeURIComponent(rfqId)}`)
}

// 담당자 전용 (고객이 호출하면 403)
export function getAnalysis(rfqId: string | number): Promise<AnalysisResponse> {
  return request<AnalysisResponse>('GET', `/api/rfqs/${encodeURIComponent(rfqId)}/analysis`)
}

// 고객용: REGISTERED 견적만 (단가·연도별 단가·납기·유효기간·조건)
export function getCustomerQuotes(rfqId: string | number): Promise<QuoteSummary[]> {
  return request<QuoteSummary[]>('GET', `/api/rfqs/${encodeURIComponent(rfqId)}/quotes`)
}
