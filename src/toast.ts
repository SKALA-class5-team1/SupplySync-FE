import { reactive } from 'vue'

export interface ToastItem {
  id: number
  text: string
  kind: 'info' | 'ok' | 'err'
}

export const toasts = reactive<ToastItem[]>([])
let seq = 0

export function notify(text: string, kind: ToastItem['kind'] = 'info') {
  const id = ++seq
  toasts.push({ id, text, kind })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }, 3200)
}
