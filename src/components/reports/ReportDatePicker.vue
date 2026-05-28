<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

const model = defineModel<string>({ required: true })
const endModel = defineModel<string>('end', { required: true })

const value = shallowRef<{
  start: DateValue | undefined
  end: DateValue | undefined
}>({
  start: parseModelValue(model.value),
  end: parseModelValue(endModel.value || model.value)
})

const label = computed(() => {
  if (!value.value.start) return 'Pick a date range'
  if (!value.value.end) return `${value.value.start.toString()} - ...`

  return `${value.value.start.toString()} - ${value.value.end.toString()}`
})

watch([model, endModel], ([nextStart, nextEnd]) => {
  const nextStartDate = parseModelValue(nextStart)
  const nextEndDate = parseModelValue(nextEnd || nextStart)

  if (
    nextStartDate.toString() !== value.value.start?.toString()
    || nextEndDate.toString() !== value.value.end?.toString()
  ) {
    value.value = {
      start: nextStartDate,
      end: nextEndDate
    }
  }
})

watch(value, (nextValue) => {
  if (!nextValue.start || !nextValue.end) return

  const nextStart = nextValue.start.toString()
  const nextEnd = nextValue.end.toString()

  if (nextStart !== model.value) {
    model.value = nextStart
  }

  if (nextEnd !== endModel.value) {
    endModel.value = nextEnd
  }
})

function parseModelValue(date: string | undefined): DateValue {
  if (!date) return today(getLocalTimeZone())

  try {
    return parseDate(date)
  } catch {
    return today(getLocalTimeZone())
  }
}
</script>

<template>
  <UPopover :content="{ align: 'start' }" :modal="true">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      trailing-icon="i-lucide-chevron-down"
      :label="label"
      class="w-full justify-between"
    />

    <template #content>
      <UCalendar
        v-model="value"
        range
        :number-of-months="2"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
