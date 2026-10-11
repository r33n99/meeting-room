import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { createDatabase } from './database'
import { createHandlers } from './handlers'
import { roomNow, shiftDate } from '@/domain/time'

const origin = 'http://localhost'
const db = createDatabase()
const server = setupServer(...createHandlers(db, 0, origin))
const date = shiftDate(roomNow().date, 3)
const input = { date, start: '09:00', end: '10:00', title: 'Тест' }
const send = (path: string, method: string, body?: unknown) =>
  fetch(`${origin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  db.reset()
  server.resetHandlers(...createHandlers(db, 0, origin))
})
afterAll(() => server.close())

describe('mock HTTP API', () => {
  it('creates, lists, edits and deletes through HTTP', async () => {
    const created = await send('/api/bookings', 'POST', input)
    expect(created.status).toBe(201)
    const booking = await created.json()
    expect(
      await (await send(`/api/bookings?date=${date}`, 'GET')).json(),
    ).toEqual([booking])
    expect(
      (
        await send(`/api/bookings/${booking.id}`, 'PATCH', {
          ...input,
          title: 'Обновлено',
        })
      ).status,
    ).toBe(200)
    expect((await send(`/api/bookings/${booking.id}`, 'DELETE')).status).toBe(
      204,
    )
    expect(
      await (await send(`/api/bookings?date=${date}`, 'GET')).json(),
    ).toEqual([])
  })
  it('returns 409 for overlap and allows touching boundaries', async () => {
    await send('/api/bookings', 'POST', input)
    expect(
      (
        await send('/api/bookings', 'POST', {
          ...input,
          start: '09:30',
          end: '10:30',
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await send('/api/bookings', 'POST', {
          ...input,
          start: '10:00',
          end: '10:30',
        })
      ).status,
    ).toBe(201)
  })
  it('enforces rules independently of the frontend', async () => {
    const response = await send('/api/bookings', 'POST', {
      ...input,
      end: '09:15',
    })
    expect(response.status).toBe(422)
    expect((await response.json()).fields.end).toContain('30 минут')
    expect(
      (
        await send('/api/bookings', 'POST', {
          ...input,
          date: shiftDate(roomNow().date, -1),
        })
      ).status,
    ).toBe(422)
    expect((await send('/api/bookings', 'POST', null)).status).toBe(422)
  })
  it('does not accept two simultaneous overlapping creates', async () => {
    const responses = await Promise.all([
      send('/api/bookings', 'POST', input),
      send('/api/bookings', 'POST', input),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ])
  })
  it('simulates a competing booking that appears after 409', async () => {
    await send('/api/demo/scenario', 'POST', { scenario: 'conflict' })
    expect((await send('/api/bookings', 'POST', input)).status).toBe(409)
    const rows = await (await send(`/api/bookings?date=${date}`, 'GET')).json()
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Встреча другого участника')
  })
  it('recovers from a one-shot server error without saving the failed request', async () => {
    await send('/api/demo/scenario', 'POST', { scenario: 'mutation-error' })
    expect((await send('/api/bookings', 'POST', input)).status).toBe(503)
    expect(db.all().filter((row) => row.date === date)).toHaveLength(0)
    expect((await send('/api/bookings', 'POST', input)).status).toBe(201)
  })
  it('returns 404 when editing or deleting an absent record', async () => {
    expect((await send('/api/bookings/missing', 'PATCH', input)).status).toBe(
      404,
    )
    expect((await send('/api/bookings/missing', 'DELETE')).status).toBe(404)
  })
  it('validates the GET date and recovers from a list error', async () => {
    expect((await send('/api/bookings?date=2026-02-30', 'GET')).status).toBe(
      422,
    )
    await send('/api/demo/scenario', 'POST', { scenario: 'list-error' })
    expect((await send(`/api/bookings?date=${date}`, 'GET')).status).toBe(503)
    expect((await send(`/api/bookings?date=${date}`, 'GET')).status).toBe(200)
  })
})
