import { delay, http, HttpResponse } from 'msw'
import {
  bookingInputSchema,
  dateSchema,
  findConflict,
  validateBookingRules,
  type Booking,
} from '@/domain/booking'
import { createDatabase } from './database'
import type { DemoScenario } from '@/api/bookings'

export function createHandlers(
  database = createDatabase(),
  latency = 450,
  origin = '',
) {
  let scenario: DemoScenario = 'normal'
  const invalid = (message: string, fields = {}) =>
    HttpResponse.json({ message, fields }, { status: 422 })

  async function mutate(request: Request, id?: string) {
    await delay(latency)
    if (scenario === 'mutation-error') {
      scenario = 'normal'
      return HttpResponse.json(
        {
          message:
            'Сервер временно недоступен. Ваши данные сохранены в форме — попробуйте снова.',
        },
        { status: 503 },
      )
    }
    if (id && !database.all().some((row) => row.id === id))
      return HttpResponse.json(
        { message: 'Бронирование уже удалено. Обновите календарь.' },
        { status: 404 },
      )
    const raw = await request.json().catch(() => null)
    const parsed = bookingInputSchema.safeParse(raw)
    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      )
      return invalid('Проверьте поля формы', fields)
    }
    const input = parsed.data
    const errors = validateBookingRules(input)
    if (errors.length)
      return invalid(
        'Проверьте дату и время',
        Object.fromEntries(errors.map((error) => [error.field, error.message])),
      )
    // Check and write synchronously after the delay: no await between them.
    if (findConflict(input, database.all(), id))
      return HttpResponse.json(
        { message: 'Это время уже занято. Выберите другой интервал.' },
        { status: 409 },
      )
    if (scenario === 'conflict') {
      scenario = 'normal'
      if (id) {
        const original = database.all().find((row) => row.id === id)!
        database.update(id, {
          ...original,
          title: 'Обновлено другим участником',
        })
      } else
        database.insert({
          ...input,
          id: crypto.randomUUID(),
          title: 'Встреча другого участника',
        })
      return HttpResponse.json(
        {
          message: id
            ? 'Бронирование изменил другой участник. Календарь обновлён — проверьте данные и повторите сохранение.'
            : 'Пока вы заполняли форму, это время заняли. Выберите другой интервал.',
        },
        { status: 409 },
      )
    }
    const booking: Booking = { ...input, id: id ?? crypto.randomUUID() }
    if (id) database.update(id, booking)
    else database.insert(booking)
    return HttpResponse.json(booking, { status: id ? 200 : 201 })
  }

  return [
    http.get(`${origin}/api/bookings`, async ({ request }) => {
      await delay(latency)
      if (scenario === 'list-error') {
        scenario = 'normal'
        return HttpResponse.json(
          { message: 'Не удалось загрузить расписание. Попробуйте ещё раз.' },
          { status: 503 },
        )
      }
      const date = new URL(request.url).searchParams.get('date')
      if (!dateSchema.safeParse(date).success)
        return invalid('Некорректная дата')
      return HttpResponse.json(
        database
          .all()
          .filter((booking) => booking.date === date)
          .sort((a, b) => a.start.localeCompare(b.start)),
      )
    }),
    http.post(`${origin}/api/bookings`, ({ request }) => mutate(request)),
    http.patch(`${origin}/api/bookings/:id`, ({ request, params }) =>
      mutate(request, String(params.id)),
    ),
    http.delete(`${origin}/api/bookings/:id`, async ({ params }) => {
      await delay(latency)
      if (scenario === 'mutation-error') {
        scenario = 'normal'
        return HttpResponse.json(
          { message: 'Не удалось удалить бронирование. Попробуйте ещё раз.' },
          { status: 503 },
        )
      }
      if (!database.all().some((row) => row.id === params.id))
        return HttpResponse.json(
          { message: 'Бронирование уже удалено.' },
          { status: 404 },
        )
      database.remove(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${origin}/api/demo/scenario`, async ({ request }) => {
      const input = (await request.json()) as { scenario: DemoScenario }
      if (
        !['normal', 'conflict', 'mutation-error', 'list-error'].includes(
          input.scenario,
        )
      )
        return invalid('Неизвестный сценарий')
      scenario = input.scenario
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${origin}/api/demo/reset`, () => {
      database.reset()
      scenario = 'normal'
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
