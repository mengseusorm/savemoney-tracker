<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../utils/api'
import { formatDate } from '../utils/money'
import { useAuth } from '../composables/useAuth'
import type { Currency, DataResponse, ListResponse } from '../types/money'

const schema = z.object({
  code: z.string().trim().length(3, 'Code must be 3 characters').transform(value => value.toUpperCase()),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  symbol: z.string().trim().max(12, 'Symbol is too long').optional().or(z.literal('')),
  exchange_rate: z.coerce.number().gt(0, 'Exchange rate must be greater than 0'),
  is_active: z.boolean()
})

type CurrencyForm = z.output<typeof schema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const { token } = useAuth()

const currencies = ref<Currency[]>([])
const isFetching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const selectedCurrency = ref<Currency | null>(null)
const currencyToDelete = ref<Currency | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const state = reactive<CurrencyForm>({
  code: '',
  name: '',
  symbol: '',
  exchange_rate: 1,
  is_active: true
})

const modalTitle = computed(() => selectedCurrency.value ? 'Edit currency' : 'New currency')
const modalDescription = computed(() => selectedCurrency.value ? 'Update this currency exchange rate.' : 'Create a currency for amount conversion.')
const submitLabel = computed(() => selectedCurrency.value ? 'Save changes' : 'Create currency')
const filteredCurrencies = computed(() => {
  const q = search.value.trim().toLowerCase()

  return currencies.value.filter((currency) => {
    const matchesSearch = !q
      || currency.code.toLowerCase().includes(q)
      || currency.name.toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && currency.is_active)
      || (statusFilter.value === 'inactive' && !currency.is_active)

    return matchesSearch && matchesStatus
  })
})

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({ title: fallback, description, icon: 'i-lucide-alert-circle', color: 'error' })
}

function resetForm(currency?: Currency) {
  selectedCurrency.value = currency ?? null
  state.code = currency?.code ?? ''
  state.name = currency?.name ?? ''
  state.symbol = currency?.symbol ?? ''
  state.exchange_rate = Number(currency?.exchange_rate ?? 1)
  state.is_active = currency?.is_active ?? true
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(currency: Currency) {
  resetForm(currency)
  modalOpen.value = true
}

function openDeleteModal(currency: Currency) {
  currencyToDelete.value = currency
  deleteOpen.value = true
}

async function loadCurrencies() {
  if (!token.value) return

  isFetching.value = true

  try {
    const response = await apiFetch<ListResponse<Currency>>('/currencies', {
      token: token.value
    })

    currencies.value = response.data
  } catch (error) {
    showError(error, 'Unable to load currencies')
  } finally {
    isFetching.value = false
  }
}

async function saveCurrency(payload: CurrencyForm, currency?: Currency) {
  if (!token.value) return

  const response = await apiFetch<DataResponse<Currency>>(
    currency ? `/currencies/${currency.id}` : '/currencies',
    {
      method: currency ? 'PUT' : 'POST',
      token: token.value,
      body: {
        code: payload.code,
        name: payload.name,
        symbol: payload.symbol || null,
        exchange_rate: payload.exchange_rate,
        is_active: payload.is_active
      }
    }
  )

  currencies.value = currency
    ? currencies.value.map(item => item.id === response.data.id ? response.data : item)
    : [...currencies.value, response.data].sort((a, b) => a.code.localeCompare(b.code))
  toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  isSaving.value = true

  try {
    await saveCurrency(schema.parse(event.data), selectedCurrency.value ?? undefined)
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedCurrency.value ? 'Unable to update currency' : 'Unable to create currency')
  } finally {
    isSaving.value = false
  }
}

async function toggleCurrencyStatus(currency: Currency) {
  try {
    await saveCurrency({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol ?? '',
      exchange_rate: Number(currency.exchange_rate),
      is_active: !currency.is_active
    }, currency)
  } catch (error) {
    showError(error, 'Unable to update currency')
  }
}

async function confirmDelete() {
  if (!token.value || !currencyToDelete.value) return

  isDeleting.value = true

  try {
    const currency = currencyToDelete.value
    const response = await apiFetch<{ message: string }>(`/currencies/${currency.id}`, {
      method: 'DELETE',
      token: token.value
    })

    currencies.value = currencies.value.filter(item => item.id !== currency.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    currencyToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete currency')
  } finally {
    isDeleting.value = false
  }
}

function getRowItems(row: Row<Currency>): DropdownMenuItem[][] {
  return [[{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditModal(row.original)
  }, {
    label: row.original.is_active ? 'Mark inactive' : 'Mark active',
    icon: row.original.is_active ? 'i-lucide-eye-off' : 'i-lucide-eye',
    onSelect: () => toggleCurrencyStatus(row.original)
  }], [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error',
    onSelect: () => openDeleteModal(row.original)
  }]]
}

const columns: TableColumn<Currency>[] = [{
  accessorKey: 'code',
  header: 'Currency',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, `${row.original.code} ${row.original.symbol ?? ''}`),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.name)
  ])
}, {
  accessorKey: 'exchange_rate',
  header: 'Exchange Rate',
  cell: ({ row }) => h('span', { class: 'font-medium tabular-nums' }, Number(row.original.exchange_rate).toFixed(6))
}, {
  accessorKey: 'is_active',
  header: 'Status',
  cell: ({ row }) => h(UBadge, {
    color: row.original.is_active ? 'success' : 'neutral',
    variant: 'subtle'
  }, () => row.original.is_active ? 'Active' : 'Inactive')
}, {
  accessorKey: 'updated_at',
  header: 'Updated',
  cell: ({ row }) => formatDate(row.original.updated_at)
}, {
  id: 'actions',
  cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
    items: getRowItems(row),
    content: { align: 'end' }
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    class: 'ml-auto'
  })))
}]

onMounted(loadCurrencies)
</script>

<template>
  <UDashboardPanel id="currencies">
    <template #header>
      <UDashboardNavbar title="Currencies">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New currency"
            icon="i-lucide-plus"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search currencies"
          class="w-full sm:max-w-sm"
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' }
          ]"
          class="w-full sm:w-36"
        />
      </div>

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="filteredCurrencies"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredCurrencies.length }} currenc{{ filteredCurrencies.length === 1 ? 'y' : 'ies' }}
        </div>

        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="table?.tableApi?.getState().pagination.pageSize"
          :total="table?.tableApi?.getFilteredRowModel().rows.length"
          @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
        />
      </div>
    </template>
  </UDashboardPanel>

  <ResourceFormModal
    v-model:open="modalOpen"
    :title="modalTitle"
    :description="modalDescription"
    :schema="schema"
    :state="state"
    :submit-label="submitLabel"
    :loading="isSaving"
    @submit="onSubmit"
  >
    <div class="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <UFormField
        label="Code"
        name="code"
        required
      >
        <UInput
          v-model="state.code"
          placeholder="USD"
          class="w-full uppercase"
          maxlength="3"
          autofocus
        />
      </UFormField>

      <UFormField
        label="Name"
        name="name"
        required
      >
        <UInput
          v-model="state.name"
          placeholder="US Dollar"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <UFormField
        label="Symbol"
        name="symbol"
      >
        <UInput
          v-model="state.symbol"
          placeholder="$"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Exchange rate"
        name="exchange_rate"
        required
      >
        <UInput
          v-model="state.exchange_rate"
          type="number"
          step="0.000001"
          min="0"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      label="Active"
      name="is_active"
      class="flex items-center justify-between gap-4"
    >
      <USwitch v-model="state.is_active" />
    </UFormField>
  </ResourceFormModal>

  <DeleteConfirmModal
    v-model:open="deleteOpen"
    title="Delete currency"
    :description="`Delete ${currencyToDelete?.code ?? 'this currency'}? Existing records will keep converted base amounts.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />
</template>
