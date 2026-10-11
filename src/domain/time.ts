export const ROOM_TIME_ZONE = 'Asia/Bishkek'
export const DAY_START = 9 * 60
export const DAY_END = 18 * 60

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

export function toTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`
}

export function roomNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ROOM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes:
      Number(get('hour')) * 60 +
      Number(get('minute')) +
      Number(get('second')) / 60,
  }
}

export function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('ru-RU', {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const remainder = minutes % 60
  return `${Math.floor(minutes / 60)} ч${remainder ? ` ${remainder} мин` : ''}`
}
