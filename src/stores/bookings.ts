import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, bookingsApi } from '@/api/bookings'
import { roomNow } from '@/domain/time'
import type { Booking, BookingInput } from '@/domain/booking'

export const useBookingsStore = defineStore('bookings', () => {
  const selectedDate = ref(roomNow().date)
  const bookings = ref<Booking[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  const sortedBookings = computed(() =>
    [...bookings.value].sort((a, b) => a.start.localeCompare(b.start)),
  )
  let controller: AbortController | undefined

  async function load(clear = false) {
    const date = selectedDate.value
    controller?.abort()
    const request = new AbortController()
    controller = request
    if (clear) bookings.value = []
    isLoading.value = true
    loadError.value = ''
    try {
      const result = await bookingsApi.list(date, request.signal)
      if (!request.signal.aborted && date === selectedDate.value)
        bookings.value = result
    } catch (error) {
      if (!request.signal.aborted) {
        loadError.value =
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить бронирования'
      }
    } finally {
      if (!request.signal.aborted) isLoading.value = false
    }
  }

  async function selectDate(date: string) {
    selectedDate.value = date
    await load(true)
  }

  async function save(input: BookingInput, id?: string) {
    try {
      const booking = id
        ? await bookingsApi.update(id, input)
        : await bookingsApi.create(input)
      // The dialog date may differ from the day currently on screen.
      if (selectedDate.value !== booking.date) selectedDate.value = booking.date
      await load(true)
      return booking
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 404)
      )
        await load()
      throw error
    }
  }

  async function remove(id: string) {
    try {
      await bookingsApi.remove(id)
      await load()
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) await load()
      throw error
    }
  }

  return {
    selectedDate,
    bookings,
    sortedBookings,
    isLoading,
    loadError,
    load,
    selectDate,
    save,
    remove,
  }
})
