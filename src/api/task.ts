import { ApiError, request } from './client'
import { mockEnabled, mockStream } from '../mock'
import { session } from '../session'
import type { StepName, TaskStatus } from './types'

export const TASK_EVENTS = [
  'STEP_START', 'STEP_END', 'TOOL_START', 'TOOL_END', 'TOKEN',
  'CLARIFICATION_REQUIRED', 'APPROVAL_REQUIRED', 'RUN_ON_HOLD', 'RUN_END', 'RUN_FAILED', 'DONE', 'FAILED',
] as const
export type TaskEventName = (typeof TASK_EVENTS)[number]

export interface TaskEvent {
  event: TaskEventName
  data: unknown
}

export interface TaskState {
  task_id: string
  status: TaskStatus
  current_step?: StepName | null
  failure_reason?: string | null
  outcome?: string | null // 종료 결과 REGISTERED | REJECTED. 진행 중에는 null
  [key: string]: unknown
}

// RUN_ON_HOLD(업무상 보류)는 담당자 조치 전까지 더 이상 이벤트가 오지 않으므로 종료로 본다
const TERMINAL: TaskEventName[] = ['DONE', 'FAILED', 'RUN_ON_HOLD', 'RUN_END', 'RUN_FAILED']

export function getTask(taskId: string): Promise<TaskState> {
  return request<TaskState>('GET', `/api/ai/tasks/${encodeURIComponent(taskId)}`)
}

/**
 * GET /api/ai/tasks/{task_id}/stream 을 fetch로 읽는다 (Authorization 헤더 사용).
 * 반환 함수를 호출하면 스트림을 중단한다.
 * 'terminal': DONE/FAILED 후 닫힘. 'closed': 그 전에 닫힘 (5분 제한, 토큰 만료, 네트워크 오류 등)
 */
export function openTaskStream(
  taskId: string,
  handlers: {
    onEvent: (e: TaskEvent) => void
    onDisconnect: (reason: 'terminal' | 'closed') => void
  },
): () => void {
  if (mockEnabled()) return mockStream(taskId, session.user, handlers)

  const controller = new AbortController()
  const url = `/api/ai/tasks/${encodeURIComponent(taskId)}/stream`

  ;(async () => {
    let finished = false
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new ApiError(res.status, null)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const parsed = parseBlock(block)
          if (!parsed) continue
          handlers.onEvent(parsed)
          if (TERMINAL.includes(parsed.event)) finished = true
        }
      }
      handlers.onDisconnect(finished ? 'terminal' : 'closed')
    } catch {
      if (controller.signal.aborted) return
      handlers.onDisconnect('closed')
    }
  })()

  return () => controller.abort()
}

function parseBlock(block: string): TaskEvent | null {
  let name = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (!(TASK_EVENTS as readonly string[]).includes(name)) return null
  const raw = dataLines.join('\n')
  let data: unknown = raw
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    // JSON이 아니면 문자열 그대로 둔다
  }
  return { event: name as TaskEventName, data }
}
