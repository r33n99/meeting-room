import type { Booking, BookingField, BookingInput } from '@/domain/booking'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Partial<Record<BookingField, string>> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError(
      0,
      'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.',
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      body.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      body.fields,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const bookingsApi = {
  list: (date: string, signal?: AbortSignal) =>
    request<Booking[]>(`/api/bookings?date=${encodeURIComponent(date)}`, {
      signal,
    }),
  create: (input: BookingInput) =>
    request<Booking>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, input: BookingInput) =>
    request<Booking>(`/api/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/api/bookings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
}

export type DemoScenario =
  | 'conflict'
  | 'mutation-error'
  | 'list-error'
  | 'normal'
export const demoApi = {
  scenario: (scenario: DemoScenario) =>
    request<void>('/api/demo/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),
  reset: () => request<void>('/api/demo/reset', { method: 'POST' }),
}
