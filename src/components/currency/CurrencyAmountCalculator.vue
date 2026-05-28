<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Currency } from '../../types/money'

const props = withDefaults(defineProps<{
  currencies: Currency[]
  amountLabel?: string
  amountName?: string
  currencyName?: string
}>(), {
  amountLabel: 'Amount',
  amountName: 'amount',
  currencyName: 'currency_id'
})

const amount = defineModel<number | string>('amount', { default: 0 })
const currencyId = defineModel<number>('currencyId', { default: 0 })
const emit = defineEmits<{
  apply: [payload: { amount: number, currencyId: number, exchangeRate: number, convertedAmount: number }]
}>()

const currencyItems = computed(() => props.currencies
  .filter(currency => currency.is_active || currency.id === currencyId.value)
  .map(currency => ({
    label: `${currency.code} - ${currency.name}`,
    value: currency.id
  })))
const selectedCurrency = computed(() => props.currencies.find(currency => currency.id === currencyId.value) ?? props.currencies[0])
const exchangeRate = computed(() => Number(selectedCurrency.value?.exchange_rate ?? 1))
const amountInput = computed({
  get: () => amount.value === '' ? '' : String(amount.value),
  set: (value: string) => {
    amount.value = value
  }
})
const numericAmount = computed(() => {
  const value = Number(amount.value || 0)

  return Number.isFinite(value) ? value : 0
})
const convertedAmount = computed(() => exchangeRate.value > 0 ? numericAmount.value / exchangeRate.value : 0)
const calculatorOpen = ref(false)

watch(() => props.currencies, (currencies) => {
  if (!currencyId.value && currencies.length) {
    currencyId.value = currencies.find(currency => currency.code === 'USD')?.id ?? currencies[0]?.id ?? 0
  }
}, { immediate: true })

watch([amount, currencyId, exchangeRate], () => {
  emitCalculation()
})

function emitCalculation() {
  emit('apply', {
    amount: numericAmount.value,
    currencyId: currencyId.value,
    exchangeRate: exchangeRate.value,
    convertedAmount: convertedAmount.value
  })
}

function applyCalculatorValue(value: number) {
  amount.value = value
  emitCalculation()
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <UFormField
        :label="amountLabel"
        :name="amountName"
        required
      >
        <UInput
          v-model="amountInput"
          type="number"
          step="0.01"
          min="0"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Currency"
        :name="currencyName"
        required
      >
        <USelect
          v-model="currencyId"
          :items="currencyItems"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="flex justify-end">
      <UButton
        label="Calculate"
        icon="i-lucide-calculator"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="calculatorOpen = true"
      />
    </div>

    <SimpleCalculatorModal
      v-model:open="calculatorOpen"
      :initial-value="numericAmount"
      :currency-code="selectedCurrency?.code ?? 'USD'"
      :exchange-rate="exchangeRate"
      title="Calculator"
      :description="`${selectedCurrency?.code ?? 'USD'} to base currency`"
      @apply="applyCalculatorValue"
    />
  </div>
</template>
