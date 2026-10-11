<script setup lang="ts">
import { ref } from 'vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { RiCalendar2Line, RiArrowDownSLine } from '@remixicon/vue'
import CalendarMonth from './CalendarMonth.vue'
import { formatDate } from '@/domain/time'

defineProps<{
  modelValue: string
  id?: string
  label?: string
  disabled?: boolean
  invalid?: boolean
  describedby?: string
  minDate?: string
  compact?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
const open = ref(false)
function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      :id="id"
      type="button"
      class="date-trigger"
      :class="{ 'date-trigger--compact': compact }"
      :disabled="disabled"
      :aria-label="label"
      :aria-invalid="invalid"
      :aria-describedby="describedby"
      @blur="emit('blur')"
    >
      <RiCalendar2Line size="18" aria-hidden="true" /><span>{{
        formatDate(modelValue, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).replace(' г.', '')
      }}</span
      ><RiArrowDownSLine size="18" class="date-caret" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        as-child
        :side-offset="6"
        align="start"
        :collision-padding="16"
        aria-label="Выбор даты"
      >
        <div class="date-popover">
          <CalendarMonth
            :model-value="modelValue"
            :min-date="minDate"
            @update:model-value="select"
          />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped src="./DatePicker.scss"></style>
