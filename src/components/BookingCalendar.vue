<script setup lang="ts">
import { computed } from 'vue'
import { RiAddLine } from '@remixicon/vue'
import type { Booking } from '@/domain/booking'
import { findConflict } from '@/domain/booking'
import { DAY_END, DAY_START, toMinutes, toTime } from '@/domain/time'
import { useRoomClock } from '@/composables/useRoomClock'

const props = defineProps<{
  date: string
  bookings: Booking[]
  loading: boolean
  unavailable: boolean
}>()
const emit = defineEmits<{
  create: [start: string]
  edit: [booking: Booking]
}>()
const { current } = useRoomClock()
const slots = Array.from({ length: 18 }, (_, index) => DAY_START + index * 30)
const hours = Array.from({ length: 10 }, (_, index) => DAY_START + index * 60)
const pixelsPerMinute = 1.12
const height = (DAY_END - DAY_START) * pixelsPerMinute
const position = (minute: number) => (minute - DAY_START) * pixelsPerMinute
const elapsed = computed(() =>
  props.date < current.value.date
    ? height
    : props.date > current.value.date
      ? 0
      : Math.max(0, Math.min(height, position(current.value.minutes))),
)
const showNow = computed(
  () =>
    props.date === current.value.date &&
    current.value.minutes >= DAY_START &&
    current.value.minutes <= DAY_END,
)
function isPast(minute: number) {
  return (
    props.date < current.value.date ||
    (props.date === current.value.date && minute < current.value.minutes)
  )
}
function disabledSlot(minute: number) {
  return (
    props.unavailable ||
    props.loading ||
    isPast(minute) ||
    Boolean(
      findConflict(
        { date: props.date, start: toTime(minute), end: toTime(minute + 30) },
        props.bookings,
      ),
    )
  )
}
</script>

<template>
  <div
    class="day-calendar"
    :aria-busy="loading"
    aria-label="Календарь бронирований"
  >
    <div class="timeline" :style="{ height: `${height}px` }">
      <div
        v-if="elapsed > 0"
        class="elapsed-area"
        :style="{ height: `${elapsed}px` }"
      />
      <div
        v-for="hour in hours"
        :key="hour"
        class="hour-line"
        :style="{ top: `${position(hour)}px` }"
      >
        <span>{{ toTime(hour) }}</span>
      </div>
      <button
        v-for="slot in slots"
        :key="slot"
        type="button"
        class="time-slot"
        :style="{
          top: `${position(slot)}px`,
          height: `${30 * pixelsPerMinute}px`,
        }"
        :disabled="disabledSlot(slot)"
        :aria-label="`Забронировать с ${toTime(slot)}`"
        @click="emit('create', toTime(slot))"
      >
        <RiAddLine v-if="!disabledSlot(slot)" size="18" aria-hidden="true" />
      </button>
      <template v-if="loading && bookings.length === 0"
        ><div
          v-for="slot in [600, 720, 900]"
          :key="slot"
          class="booking-skeleton"
          :style="{ top: `${position(slot)}px` }"
      /></template>
      <button
        v-for="booking in bookings"
        :key="booking.id"
        type="button"
        class="booking-block"
        :class="{
          past:
            props.date < current.date ||
            (props.date === current.date &&
              toMinutes(booking.end) <= current.minutes),
        }"
        :style="{
          top: `${position(toMinutes(booking.start)) + 2}px`,
          height: `${(toMinutes(booking.end) - toMinutes(booking.start)) * pixelsPerMinute - 4}px`,
        }"
        :aria-label="`${booking.title || 'Без названия'}, ${booking.start}–${booking.end}. Открыть бронирование`"
        @click="emit('edit', booking)"
      >
        <span class="booking-title">{{ booking.title || 'Без названия' }}</span
        ><span class="booking-time"
          >{{ booking.start }} — {{ booking.end }}</span
        >
      </button>
      <div v-if="showNow" class="now-line" :style="{ top: `${elapsed}px` }">
        <span>{{ toTime(Math.floor(current.minutes)) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped src="./BookingCalendar.scss"></style>
