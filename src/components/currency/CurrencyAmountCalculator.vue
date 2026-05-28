<script setup lang="ts">
import { computed, watch } from 'vue'
import { formatCurrency } from '../../utils/money'
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

const amount = defineModel<number>('amount', { default: 0 })
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
const convertedAmount = computed(() => Number(amount.value || 0) * exchangeRate.value)

watch(() => props.currencies, (currencies) => {
  if (!currencyId.value && currencies.length) {
    currencyId.value = currencies.find(currency => currency.code === 'USD')?.id ?? currencies[0]?.id ?? 0
  }
}, { immediate: true })

function applyCalculation() {
  emit('apply', {
    amount: Number(amount.value || 0),
    currencyId: currencyId.value,
    exchangeRate: exchangeRate.value,
    convertedAmount: convertedAmount.value
  })
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
          v-model="amount"
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

    <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-default bg-muted/40 px-3 py-2 text-sm">
      <div class="text-muted">
        <span>{{ selectedCurrency?.code ?? 'USD' }} rate:</span>
        <span class="ms-1 font-medium text-highlighted">{{ exchangeRate.toFixed(6) }}</span>
      </div>

      <div class="text-muted">
        <span>Base amount:</span>
        <span class="ms-1 font-medium text-highlighted">{{ formatCurrency(convertedAmount) }}</span>
      </div>

      <UButton
        label="Apply calculate"
        icon="i-lucide-calculator"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="applyCalculation"
      />
    </div>
  </div>
</template>
