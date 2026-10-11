import { z } from 'zod'
import { DAY_END, DAY_START, roomNow, toMinutes, toTime } from './time'

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Выберите дату')
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`)
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, 'Некорректная дата')

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Укажите время в формате ЧЧ:ММ')
export const bookingInputSchema = z.object({
  date: dateSchema,
  start: timeSchema,
  end: timeSchema,
  title: z
    .string()
    .trim()
    .max(100, 'Название — не больше 100 символов')
    .optional(),
})

export type BookingInput = z.infer<typeof bookingInputSchema>
export type Booking = BookingInput & { id: string }
export type BookingField = keyof BookingInput
export type RuleError = { field: BookingField; message: string }

export function overlaps(
  a: Pick<BookingInput, 'start' | 'end'>,
  b: Pick<BookingInput, 'start' | 'end'>,
) {
  return (
    toMinutes(a.start) < toMinutes(b.end) &&
    toMinutes(a.end) > toMinutes(b.start)
  )
}

export function findConflict(
  input: BookingInput,
  bookings: Booking[],
  excludeId?: string,
) {
  return bookings.find(
    (booking) =>
      booking.id !== excludeId &&
      booking.date === input.date &&
      overlaps(input, booking),
  )
}

export function validateBookingRules(
  input: BookingInput,
  now = new Date(),
): RuleError[] {
  const errors: RuleError[] = []
  const start = toMinutes(input.start)
  const end = toMinutes(input.end)
  if (start < DAY_START || start >= DAY_END)
    errors.push({ field: 'start', message: 'Начало — с 09:00 до 17:59' })
  if (end <= DAY_START || end > DAY_END)
    errors.push({ field: 'end', message: 'Окончание — до 18:00' })
  if (start >= end)
    errors.push({ field: 'end', message: 'Окончание должно быть позже начала' })
  else if (end - start < 30)
    errors.push({
      field: 'end',
      message: 'Минимальная длительность — 30 минут',
    })
  else if (end - start > 120)
    errors.push({ field: 'end', message: 'Максимальная длительность — 2 часа' })
  const current = roomNow(now)
  if (input.date < current.date)
    errors.push({ field: 'date', message: 'Нельзя бронировать прошедшую дату' })
  else if (input.date === current.date && start < current.minutes)
    errors.push({
      field: 'start',
      message: 'Это время уже прошло. Выберите более позднее начало',
    })
  return errors
}

export function createFormSchema(now: () => Date) {
  return bookingInputSchema.superRefine((input, context) => {
    for (const error of validateBookingRules(input, now())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [error.field],
        message: error.message,
      })
    }
  })
}

export function firstAvailable(
  date: string,
  bookings: Booking[],
  now = new Date(),
): string | undefined {
  const current = roomNow(now)
  if (date < current.date) return undefined
  const first =
    date === current.date
      ? Math.max(DAY_START, Math.ceil(current.minutes))
      : DAY_START
  // Free intervals can begin at any minute, including the end of an off-grid booking.
  const candidates = [
    ...new Set([
      first,
      ...bookings
        .filter((booking) => booking.date === date)
        .map((booking) => toMinutes(booking.end)),
    ]),
  ].sort((a, b) => a - b)
  for (const start of candidates) {
    if (start < first || start > DAY_END - 30) continue
    if (
      !findConflict(
        { date, start: toTime(start), end: toTime(start + 30) },
        bookings,
      )
    )
      return toTime(start)
  }
  return undefined
}
