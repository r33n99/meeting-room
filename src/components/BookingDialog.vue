<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import {
  RiTimeLine,
  RiDeleteBin6Line,
  RiLoader4Line,
  RiErrorWarningLine,
  RiCloseLine,
} from '@remixicon/vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogTitle,
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from 'reka-ui'
import DatePicker from './DatePicker.vue'
import TimeField from './TimeField.vue'
import {
  createFormSchema,
  findConflict,
  type Booking,
  type BookingInput,
} from '@/domain/booking'
import { formatDuration, roomNow, toMinutes } from '@/domain/time'
import { ApiError, bookingsApi } from '@/api/bookings'
import { useBookingsStore } from '@/stores/bookings'
import { useRoomClock } from '@/composables/useRoomClock'

const props = defineProps<{
  open: boolean
  booking?: Booking
  initial: BookingInput
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [message: string]
  closed: []
}>()
const store = useBookingsStore()
const { current } = useRoomClock()
const serverError = ref('')
const deleting = ref(false)
const formBookings = ref<Booking[]>([])
const availabilityError = ref('')
const checkingAvailability = ref(false)
const deleteOpen = ref(false)
const form = useForm({
  validationSchema: toTypedSchema(createFormSchema(() => new Date())),
  initialValues: props.initial,
})
const [date] = form.defineField('date')
const [start] = form.defineField('start')
const [end] = form.defineField('end')
const [title, titleAttrs] = form.defineField('title')
const errors = form.errors
const busy = computed(() => form.isSubmitting.value || deleting.value)
const pastBooking = computed(
  () =>
    !!props.booking &&
    (props.booking.date < current.value.date ||
      (props.booking.date === current.value.date &&
        toMinutes(props.booking.start) < current.value.minutes)),
)
const duration = computed(() => {
  const minutes = toMinutes(end.value ?? '') - toMinutes(start.value ?? '')
  return Number.isFinite(minutes) && minutes > 0 ? formatDuration(minutes) : ''
})
const sameDayBookings = computed(() =>
  date.value === store.selectedDate ? store.sortedBookings : formBookings.value,
)
const localConflict = computed(() => {
  if (!date.value || !start.value || !end.value) return
  return findConflict(
    { date: date.value, start: start.value, end: end.value },
    sameDayBookings.value,
    props.booking?.id,
  )
})
const otherBookings = computed(() =>
  sameDayBookings.value.filter((booking) => booking.id !== props.booking?.id),
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.resetForm({
        values: props.booking
          ? {
              date: props.booking.date,
              start: props.booking.start,
              end: props.booking.end,
              title: props.booking.title ?? '',
            }
          : { ...props.initial },
      })
      serverError.value = ''
      availabilityError.value = ''
      deleteOpen.value = false
    }
  },
)

watch(
  [date, () => props.open, () => store.selectedDate],
  async ([value, open], _, onCleanup) => {
    formBookings.value = []
    availabilityError.value = ''
    checkingAvailability.value = false
    if (
      !open ||
      !value ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value === store.selectedDate
    )
      return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    checkingAvailability.value = true
    try {
      const result = await bookingsApi.list(value, controller.signal)
      if (!controller.signal.aborted) formBookings.value = result
    } catch (error) {
      if (!controller.signal.aborted)
        availabilityError.value = 'Не удалось загрузить занятые интервалы'
    } finally {
      if (!controller.signal.aborted) checkingAvailability.value = false
    }
  },
)

async function refreshFormDate() {
  if (date.value !== store.selectedDate) {
    try {
      formBookings.value = await bookingsApi.list(date.value ?? '')
    } catch {
      availabilityError.value = 'Не удалось обновить занятые интервалы'
    }
  }
}

const submit = form.handleSubmit(async (input) => {
  serverError.value = ''
  // Revalidate against the clock at submission, including long-open forms.
  if (localConflict.value) {
    form.setFieldError(
      'end',
      `Время пересекается с бронью ${localConflict.value.start}–${localConflict.value.end}`,
    )
    return
  }
  try {
    await store.save(input, props.booking?.id)
    emit('update:open', false)
    emit(
      'saved',
      props.booking ? 'Бронирование обновлено' : 'Бронирование создано',
    )
  } catch (error) {
    serverError.value =
      error instanceof Error
        ? error.message
        : 'Не удалось сохранить бронирование'
    if (error instanceof ApiError) {
      form.setErrors(error.fields)
      if (error.status === 409) await refreshFormDate()
    }
  }
})

async function remove(event: Event) {
  event.preventDefault()
  if (!props.booking || busy.value) return
  deleting.value = true
  serverError.value = ''
  try {
    await store.remove(props.booking.id)
    deleteOpen.value = false
    emit('update:open', false)
    emit('saved', 'Бронирование удалено')
  } catch (error) {
    deleteOpen.value = false
    serverError.value =
      error instanceof Error ? error.message : 'Не удалось удалить бронирование'
  } finally {
    deleting.value = false
  }
}

function updateOpen(open: boolean) {
  if (!busy.value) emit('update:open', open)
}

function closeAutoFocus(event: Event) {
  event.preventDefault()
  emit('closed')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="updateOpen">
    <DialogPortal>
      <DialogOverlay class="modal-overlay" />
      <DialogContent
        class="modal-content booking-modal"
        @escape-key-down="busy && $event.preventDefault()"
        @pointer-down-outside="busy && $event.preventDefault()"
        @close-auto-focus="closeAutoFocus"
      >
        <div class="modal-header">
          <DialogTitle>{{
            booking ? 'Бронирование' : 'Новое бронирование'
          }}</DialogTitle>
          <DialogDescription class="sr-only"
            >Дата, время и название встречи</DialogDescription
          >
        </div>
        <form class="booking-form" novalidate @submit="submit">
          <div v-if="serverError" role="alert" class="form-error">
            <RiErrorWarningLine size="17" aria-hidden="true" />
            <p>{{ serverError }}</p>
          </div>
          <div v-if="pastBooking" role="status" class="form-notice">
            Встреча началась. Доступно удаление.
          </div>
          <fieldset :disabled="busy || pastBooking" class="form-fields">
            <div>
              <label class="field-label" for="booking-title"
                >Название встречи</label
              >
              <input
                id="booking-title"
                v-model="title"
                v-bind="titleAttrs"
                class="name-input"
                placeholder="Название"
                maxlength="100"
                :aria-invalid="!!errors.title"
                :aria-describedby="errors.title ? 'title-error' : undefined"
              />
              <p v-if="errors.title" id="title-error" class="field-error">
                {{ errors.title }}
              </p>
            </div>
            <div>
              <label class="field-label" for="booking-date">Дата</label>
              <DatePicker
                id="booking-date"
                :model-value="date ?? initial.date"
                label="Дата"
                :min-date="roomNow().date"
                :disabled="busy || pastBooking"
                :invalid="!!errors.date"
                :describedby="errors.date ? 'date-error' : undefined"
                @update:model-value="date = $event"
                @blur="form.setFieldTouched('date', true)"
              />
              <p v-if="errors.date" id="date-error" class="field-error">
                {{ errors.date }}
              </p>
            </div>
            <div class="time-fields">
              <div>
                <label class="field-label" for="booking-start">Начало</label>
                <TimeField
                  id="booking-start"
                  :model-value="start ?? ''"
                  label="Начало"
                  :disabled="busy || pastBooking"
                  :invalid="!!errors.start"
                  :describedby="errors.start ? 'start-error' : undefined"
                  @update:model-value="start = $event"
                  @blur="form.setFieldTouched('start', true)"
                />
                <p v-if="errors.start" id="start-error" class="field-error">
                  {{ errors.start }}
                </p>
              </div>
              <div>
                <label class="field-label" for="booking-end">Окончание</label>
                <TimeField
                  id="booking-end"
                  :model-value="end ?? ''"
                  label="Окончание"
                  :disabled="busy || pastBooking"
                  :invalid="!!errors.end"
                  :describedby="errors.end ? 'end-error' : undefined"
                  @update:model-value="end = $event"
                  @blur="form.setFieldTouched('end', true)"
                />
                <p v-if="errors.end" id="end-error" class="field-error">
                  {{ errors.end }}
                </p>
              </div>
            </div>
          </fieldset>
          <div v-if="duration" class="form-duration">
            <RiTimeLine size="13" aria-hidden="true" />{{ duration }}
          </div>
          <p
            v-if="localConflict && !pastBooking && !errors.end && !serverError"
            class="field-error"
            role="status"
          >
            Пересечение: {{ localConflict.start }}–{{ localConflict.end }}
          </p>
          <p v-if="checkingAvailability" class="form-duration" role="status">
            Загрузка…
          </p>
          <p v-else-if="availabilityError" class="field-error" role="status">
            {{ availabilityError }}
          </p>
          <div v-else-if="otherBookings.length" class="busy-intervals">
            <span class="busy-intervals-label">Занято</span
            ><span
              v-for="item in otherBookings"
              :key="item.id"
              class="busy-interval"
              >{{ item.start }}–{{ item.end }}</span
            >
          </div>
          <div class="modal-footer">
            <button
              v-if="booking"
              type="button"
              class="icon-button delete-button"
              aria-label="Удалить бронирование"
              :disabled="busy"
              @click="deleteOpen = true"
            >
              <RiDeleteBin6Line size="19" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="action-button secondary-button cancel-button"
              :disabled="busy"
              @click="updateOpen(false)"
            >
              Отмена
            </button>
            <button
              type="submit"
              class="action-button"
              :disabled="busy || pastBooking || checkingAvailability"
            >
              <RiLoader4Line
                v-if="form.isSubmitting.value"
                size="16"
                class="animate-spin"
                aria-hidden="true"
              />
              {{
                form.isSubmitting.value
                  ? 'Сохранение…'
                  : booking
                    ? 'Сохранить'
                    : 'Забронировать'
              }}
            </button>
          </div>
        </form>
        <DialogClose
          v-if="!busy"
          class="modal-close icon-button"
          aria-label="Закрыть"
          ><RiCloseLine size="19" aria-hidden="true"
        /></DialogClose>
        <AlertDialogRoot
          :open="deleteOpen"
          @update:open="!deleting && (deleteOpen = $event)"
        >
          <AlertDialogPortal>
            <AlertDialogOverlay class="modal-overlay" />
            <AlertDialogContent
              class="modal-content delete-modal"
              @escape-key-down="deleting && $event.preventDefault()"
            >
              <AlertDialogTitle>Удалить бронирование?</AlertDialogTitle>
              <AlertDialogDescription class="sr-only"
                >{{ booking?.title || 'Без названия' }}, {{ booking?.start }}–{{
                  booking?.end
                }}</AlertDialogDescription
              >
              <div class="delete-actions">
                <AlertDialogCancel as-child
                  ><button
                    type="button"
                    class="action-button secondary-button"
                    :disabled="deleting"
                  >
                    Оставить
                  </button></AlertDialogCancel
                >
                <AlertDialogAction as-child
                  ><button
                    type="button"
                    class="action-button"
                    :disabled="deleting"
                    @click="remove"
                  >
                    {{ deleting ? 'Удаление…' : 'Удалить' }}
                  </button></AlertDialogAction
                >
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialogRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss" src="./BookingDialog.scss"></style>
