import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, bookingsApi } from '@/api/bookings'
import { useBookingsStore } from './bookings'
import type { Booking } from '@/domain/booking'

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createPinia())
})

describe('bookings store', () => {
  it('does not render an older date response after a faster new-date response', async () => {
    let resolveOld!: (rows: Booking[]) => void
    vi.spyOn(bookingsApi, 'list').mockImplementation((date) =>
      date === '2026-10-12'
        ? new Promise((resolve) => {
            resolveOld = resolve
          })
        : Promise.resolve([{ id: 'new', date, start: '09:00', end: '10:00' }]),
    )
    const store = useBookingsStore()
    const olderRequest = store.selectDate('2026-10-12')
    await store.selectDate('2026-10-13')
    resolveOld([
      { id: 'old', date: '2026-10-12', start: '09:00', end: '10:00' },
    ])
    await olderRequest
    expect(store.bookings[0]?.id).toBe('new')
    expect(store.selectedDate).toBe('2026-10-13')
    expect(store.isLoading).toBe(false)
  })
  it('refreshes the calendar on conflict and preserves the original error for the form', async () => {
    const conflict = new ApiError(409, 'Занято')
    vi.spyOn(bookingsApi, 'create').mockRejectedValue(conflict)
    const list = vi
      .spyOn(bookingsApi, 'list')
      .mockResolvedValue([
        { id: 'competitor', date: '2026-10-13', start: '09:00', end: '10:00' },
      ])
    const store = useBookingsStore()
    store.selectedDate = '2026-10-13'
    await expect(
      store.save({ date: store.selectedDate, start: '09:00', end: '10:00' }),
    ).rejects.toBe(conflict)
    expect(list).toHaveBeenCalledOnce()
    expect(store.bookings[0]?.id).toBe('competitor')
  })
  it('reports a failed refresh without hiding the original conflict', async () => {
    const conflict = new ApiError(409, 'Занято')
    vi.spyOn(bookingsApi, 'create').mockRejectedValue(conflict)
    vi.spyOn(bookingsApi, 'list').mockRejectedValue(
      new ApiError(503, 'Ошибка обновления списка'),
    )
    const store = useBookingsStore()
    await expect(
      store.save({ date: store.selectedDate, start: '09:00', end: '10:00' }),
    ).rejects.toBe(conflict)
    expect(store.loadError).toBe('Ошибка обновления списка')
  })
})
