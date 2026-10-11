<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/vue'
import { formatDate, shiftDate } from '@/domain/time'
import { useRoomClock } from '@/composables/useRoomClock'

const props = defineProps<{ modelValue: string; minDate?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const month = ref(props.modelValue.slice(0, 7))
const focusDate = ref(props.modelValue)
const grid = ref<HTMLElement>()
const { current } = useRoomClock()
const today = computed(() => current.value.date)
const monthLabel = computed(() =>
  formatDate(`${month.value}-01`, { month: 'long', year: 'numeric' }).replace(
    ' г.',
    '',
  ),
)
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const days = computed(() => {
  const first = `${month.value}-01`
  const day = new Date(`${first}T12:00:00Z`).getUTCDay()
  const start = shiftDate(first, -((day + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => shiftDate(start, index))
})

watch(
  () => props.modelValue,
  (value) => {
    month.value = value.slice(0, 7)
    focusDate.value = value
  },
)

function moveMonth(amount: number) {
  const value = new Date(`${month.value}-01T12:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + amount)
  month.value = value.toISOString().slice(0, 7)
  const first = `${month.value}-01`
  focusDate.value =
    props.minDate?.slice(0, 7) === month.value ? props.minDate : first
}
function choose(date: string) {
  if (props.minDate && date < props.minDate) return
  focusDate.value = date
  emit('update:modelValue', date)
}
async function navigate(event: KeyboardEvent, date: string) {
  const offsets: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  }
  let target: string | undefined
  if (event.key in offsets) target = shiftDate(date, offsets[event.key]!)
  else if (event.key === 'Home')
    target = shiftDate(
      date,
      -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7),
    )
  else if (event.key === 'End')
    target = shiftDate(
      date,
      6 - ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7),
    )
  else if (event.key === 'PageUp' || event.key === 'PageDown') {
    const value = new Date(`${date}T12:00:00Z`)
    const day = value.getUTCDate()
    value.setUTCDate(1)
    value.setUTCMonth(value.getUTCMonth() + (event.key === 'PageUp' ? -1 : 1))
    const lastDay = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
    ).getUTCDate()
    value.setUTCDate(Math.min(day, lastDay))
    target = value.toISOString().slice(0, 10)
  }
  if (!target) return
  event.preventDefault()
  if (props.minDate && target < props.minDate) target = props.minDate
  focusDate.value = target
  month.value = target.slice(0, 7)
  await nextTick()
  grid.value
    ?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)
    ?.focus()
}
</script>

<template>
  <div class="month-calendar">
    <div class="month-toolbar">
      <span class="month-name">{{ monthLabel }}</span>
      <div class="month-arrows">
        <button
          type="button"
          class="icon-button"
          aria-label="Предыдущий месяц"
          @click="moveMonth(-1)"
        >
          <RiArrowLeftSLine size="18" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Следующий месяц"
          @click="moveMonth(1)"
        >
          <RiArrowRightSLine size="18" />
        </button>
      </div>
    </div>
    <div class="month-weekdays" aria-hidden="true">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div ref="grid" class="month-days" role="group" :aria-label="monthLabel">
      <button
        v-for="date in days"
        :key="date"
        type="button"
        :data-date="date"
        :tabindex="date === focusDate ? 0 : -1"
        :class="[
          'month-day',
          {
            selected: date === modelValue,
            outside: date.slice(0, 7) !== month,
            today: date === today,
          },
        ]"
        :disabled="!!minDate && date < minDate"
        :aria-label="
          formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })
        "
        :aria-pressed="date === modelValue"
        :aria-current="date === today ? 'date' : undefined"
        @click="choose(date)"
        @keydown="navigate($event, date)"
      >
        {{ Number(date.slice(-2)) }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped src="./CalendarMonth.scss"></style>
