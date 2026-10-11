import { describe, expect, it } from 'vitest'
import {
  bookingInputSchema,
  findConflict,
  firstAvailable,
  overlaps,
  validateBookingRules,
  type BookingInput,
} from './booking'
import { roomNow, shiftDate, toMinutes, toTime } from './time'

const now = new Date('2026-10-10T04:15:30Z') // 10:15:30 in the room's timezone.
const valid: BookingInput = {
  date: '2026-10-11',
  start: '10:00',
  end: '11:00',
  title: 'Встреча',
}
const row = { ...valid, id: 'existing' }

describe('business rules', () => {
  it.each([
    ['09:00', '09:30', true],
    ['16:00', '18:00', true],
    ['09:00', '09:29', false],
    ['09:00', '11:01', false],
    ['08:59', '09:59', false],
    ['17:30', '18:01', false],
    ['10:00', '10:00', false],
    ['11:00', '10:00', false],
    ['10:15', '10:45', true],
  ])('%s–%s validity is %s', (start, end, accepted) => {
    expect(
      validateBookingRules({ ...valid, start, end }, now).length === 0,
    ).toBe(accepted)
  })
  it('rejects past dates', () => {
    expect(
      validateBookingRules({ ...valid, date: '2026-10-09' }, now),
    ).toContainEqual(expect.objectContaining({ field: 'date' }))
  })
  it('rejects a start in the current minute when seconds have elapsed', () => {
    expect(
      validateBookingRules(
        { ...valid, date: '2026-10-10', start: '10:15', end: '10:45' },
        now,
      ),
    ).toContainEqual(expect.objectContaining({ field: 'start' }))
    expect(
      validateBookingRules(
        { ...valid, date: '2026-10-10', start: '10:16', end: '10:46' },
        now,
      ),
    ).toEqual([])
  })
  it('uses the room timezone when UTC and local dates differ', () => {
    expect(roomNow(new Date('2026-10-09T20:00:00Z'))).toEqual({
      date: '2026-10-10',
      minutes: 120,
    })
  })
  it('accepts adjacent bookings', () => {
    expect(overlaps(valid, { start: '11:00', end: '12:00' })).toBe(false)
    expect(overlaps(valid, { start: '09:00', end: '10:00' })).toBe(false)
  })
  it.each([
    ['10:30', '11:30'],
    ['09:30', '10:30'],
    ['10:15', '10:45'],
    ['09:00', '12:00'],
  ])('detects overlap with %s–%s', (start, end) => {
    expect(overlaps(valid, { start, end })).toBe(true)
  })
  it('ignores itself and other dates when editing', () => {
    expect(findConflict(valid, [row], row.id)).toBeUndefined()
    expect(
      findConflict({ ...valid, date: '2026-10-12' }, [row]),
    ).toBeUndefined()
    expect(findConflict(valid, [row])).toEqual(row)
  })
  it.each(['2026-02-30', '2026-13-01', '10-10-2026'])(
    'rejects invalid date %s',
    (date) => {
      expect(bookingInputSchema.safeParse({ ...valid, date }).success).toBe(
        false,
      )
    },
  )
  it.each(['25:00', '10:60', '9:00', ''])(
    'rejects invalid time %s',
    (start) => {
      expect(bookingInputSchema.safeParse({ ...valid, start }).success).toBe(
        false,
      )
    },
  )
  it('finds a future unoccupied suggestion', () => {
    expect(
      firstAvailable(
        '2026-10-10',
        [{ ...row, date: '2026-10-10', start: '10:30', end: '11:30' }],
        now,
      ),
    ).toBe('11:30')
    expect(firstAvailable('2026-10-09', [], now)).toBeUndefined()
    expect(
      firstAvailable('2026-10-10', [], new Date('2026-10-10T11:31:00Z')),
    ).toBeUndefined()
  })
  it('does not miss a free interval that starts outside the 30-minute grid', () => {
    const bookings = [
      { ...row, id: 'a', start: '09:00', end: '09:15' },
      { ...row, id: 'b', start: '09:45', end: '11:45' },
    ]
    expect(firstAvailable(valid.date, bookings, now)).toBe('09:15')
    expect(firstAvailable('2026-10-10', [], now)).toBe('10:16')
  })
  it('does not shift dates through the computer timezone', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(toTime(toMinutes('10:15'))).toBe('10:15')
  })
})
