<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiCheckLine,
  RiRefreshLine,
  RiErrorWarningLine,
} from '@remixicon/vue'
import CalendarMonth from '@/components/CalendarMonth.vue'
import DatePicker from '@/components/DatePicker.vue'
import BookingCalendar from '@/components/BookingCalendar.vue'
import BookingDialog from '@/components/BookingDialog.vue'
import DemoPanel from '@/components/DemoPanel.vue'
import { useBookingsStore } from '@/stores/bookings'
import {
  firstAvailable,
  type Booking,
  type BookingInput,
} from '@/domain/booking'
import {
  DAY_END,
  formatDate,
  shiftDate,
  toMinutes,
  toTime,
} from '@/domain/time'
import { useRoomClock } from '@/composables/useRoomClock'

const store = useBookingsStore()
const { current, now } = useRoomClock()
const open = ref(false)
const editing = ref<Booking>()
const initial = ref<BookingInput>({
  date: store.selectedDate,
  start: '09:00',
  end: '09:30',
  title: '',
})
const toast = ref('')
const demoEnabled =
  new URLSearchParams(window.location.search).get('demo') === '1'
let returnFocus: HTMLElement | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined
const available = computed(() =>
  firstAvailable(store.selectedDate, store.bookings, now.value),
)
const dayLabel = computed(() =>
  formatDate(store.selectedDate, { day: 'numeric', month: 'long' }),
)
const weekday = computed(() =>
  formatDate(store.selectedDate, { weekday: 'long' }),
)
const week = computed(() => {
  const weekday =
    (new Date(`${store.selectedDate}T12:00:00Z`).getUTCDay() + 6) % 7
  const monday = shiftDate(store.selectedDate, -weekday)
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
})
const bookingCount = computed(() => {
  const n = store.bookings.length
  return `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'броней' : n % 10 === 1 ? 'бронь' : n % 10 >= 2 && n % 10 <= 4 ? 'брони' : 'броней'}`
})
const cannotCreate = computed(
  () => !available.value || store.isLoading || !!store.loadError,
)

function create(start = available.value) {
  if (!start || store.isLoading || store.loadError) return
  returnFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  editing.value = undefined
  initial.value = {
    date: store.selectedDate,
    start,
    end: toTime(Math.min(DAY_END, toMinutes(start) + 30)),
    title: '',
  }
  open.value = true
}
function edit(booking: Booking) {
  returnFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  editing.value = { ...booking }
  open.value = true
}
function restoreFocus() {
  if (returnFocus?.isConnected && !(returnFocus as HTMLButtonElement).disabled)
    returnFocus.focus()
  else document.querySelector<HTMLElement>('#schedule button')?.focus()
}
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 4000)
}
onMounted(() => {
  void store.load()
})
onUnmounted(() => {
  clearTimeout(toastTimer)
})
</script>

<template>
  <a href="#schedule" class="skip-link">К расписанию</a>
  <div class="workspace">
    <header class="app-header">
      <h1>Переговорная</h1>
      <span class="header-hours">09:00 — 18:00</span>
      <button
        type="button"
        class="action-button new-booking"
        :disabled="cannotCreate"
        @click="create()"
      >
        <RiAddLine size="19" /> Забронировать
      </button>
    </header>
    <aside class="sidebar" aria-label="Выбор даты">
      <CalendarMonth
        :model-value="store.selectedDate"
        @update:model-value="store.selectDate"
      />
      <button
        type="button"
        class="sidebar-today"
        @click="store.selectDate(current.date)"
      >
        Сегодня
        <span>{{
          formatDate(current.date, { day: 'numeric', month: 'short' })
        }}</span>
      </button>
      <span class="sidebar-timezone">Бишкек · UTC+6</span>
      <DemoPanel v-if="demoEnabled" />
    </aside>
    <main id="schedule" class="schedule" aria-label="Расписание выбранного дня">
      <div class="schedule-toolbar">
        <div class="day-heading">
          <h2>{{ dayLabel }}</h2>
          <span>{{ weekday }}</span>
        </div>
        <div class="mobile-date">
          <DatePicker
            :model-value="store.selectedDate"
            label="Выбрать дату"
            compact
            @update:model-value="store.selectDate"
          />
        </div>
        <nav class="day-navigation" aria-label="Навигация по дням">
          <button
            type="button"
            class="text-button today-button"
            @click="store.selectDate(current.date)"
          >
            Сегодня
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Предыдущий день"
            @click="store.selectDate(shiftDate(store.selectedDate, -1))"
          >
            <RiArrowLeftSLine size="22" />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Следующий день"
            @click="store.selectDate(shiftDate(store.selectedDate, 1))"
          >
            <RiArrowRightSLine size="22" />
          </button>
        </nav>
      </div>
      <nav class="week-strip" aria-label="Дни недели">
        <button
          v-for="date in week"
          :key="date"
          type="button"
          :class="{
            selected: date === store.selectedDate,
            today: date === current.date,
          }"
          :aria-label="
            formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })
          "
          :aria-pressed="date === store.selectedDate"
          @click="store.selectDate(date)"
        >
          <span>{{ formatDate(date, { weekday: 'short' }) }}</span
          ><strong>{{ Number(date.slice(-2)) }}</strong>
        </button>
      </nav>
      <div class="calendar-meta" aria-live="polite">
        <span>{{
          store.isLoading
            ? 'Загрузка…'
            : store.loadError
              ? 'Ошибка загрузки'
              : bookingCount
        }}</span
        ><span v-if="!store.isLoading && !store.loadError && !available">{{
          store.selectedDate < current.date
            ? 'Прошедший день'
            : 'Нет свободного времени'
        }}</span
        ><span
          v-else-if="
            !store.isLoading && !store.loadError && store.bookings.length === 0
          "
          >Свободно</span
        >
      </div>
      <div v-if="store.loadError" class="calendar-error" role="alert">
        <RiErrorWarningLine size="19" /><span>{{ store.loadError }}</span
        ><button
          type="button"
          class="text-button"
          :disabled="store.isLoading"
          @click="store.load()"
        >
          <RiRefreshLine size="16" /> Повторить
        </button>
      </div>
      <BookingCalendar
        :date="store.selectedDate"
        :bookings="store.sortedBookings"
        :loading="store.isLoading"
        :unavailable="!!store.loadError"
        @create="create"
        @edit="edit"
      />
    </main>
  </div>
  <BookingDialog
    :open="open"
    :booking="editing"
    :initial="initial"
    @update:open="open = $event"
    @saved="notify"
    @closed="restoreFocus"
  />
  <div v-if="toast" role="status" class="toast">
    <RiCheckLine size="19" /><span>{{ toast }}</span
    ><button type="button" aria-label="Закрыть уведомление" @click="toast = ''">
      <RiCloseLine size="18" />
    </button>
  </div>
</template>

<style lang="scss" scoped src="./App.scss"></style>
