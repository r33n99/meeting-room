import type { Booking } from '@/domain/booking'
import { bookingInputSchema } from '@/domain/booking'
import { roomNow, shiftDate } from '@/domain/time'

const STORAGE_KEY = 'mesto-bookings-v1'

export function seedBookings(): Booking[] {
  const today = roomNow().date
  return [today, shiftDate(today, 1)].flatMap((date) => [
    {
      id: `${date}-standup`,
      date,
      start: '10:00',
      end: '10:45',
      title: 'Планы на неделю',
    },
    {
      id: `${date}-design`,
      date,
      start: '12:00',
      end: '13:00',
      title: 'Обсуждение дизайна',
    },
    {
      id: `${date}-team`,
      date,
      start: '15:00',
      end: '16:30',
      title: 'Командная встреча',
    },
  ])
}

export function createDatabase(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let rows = seedBookings()
  try {
    const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')
    if (Array.isArray(saved)) {
      // Validate persisted rows individually; local data is never trusted as API input.
      const valid = saved.every(
        (row) =>
          typeof row?.id === 'string' &&
          bookingInputSchema.safeParse(row).success,
      )
      if (valid) rows = saved as Booking[]
    }
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(rows))
    } catch {
      /* The current session still works without persistence. */
    }
  }
  return {
    all: () => rows.map((row) => ({ ...row })),
    insert: (booking: Booking) => {
      rows.push({ ...booking })
      persist()
    },
    update: (id: string, booking: Booking) => {
      rows = rows.map((row) => (row.id === id ? { ...booking } : row))
      persist()
    },
    remove: (id: string) => {
      rows = rows.filter((row) => row.id !== id)
      persist()
    },
    reset: () => {
      rows = seedBookings()
      persist()
    },
  }
}
