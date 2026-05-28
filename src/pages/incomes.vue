<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../utils/api'
import { formatCurrency, formatDate, formatOriginalCurrency, toDateInput } from '../utils/money'
import { useAuth } from '../composables/useAuth'
import type { Currency, DataResponse, Income, IncomeSource, ListResponse } from '../types/money'

const schema = z.object({
  income_source_id: z.coerce.number().int().gt(0, 'Income source is required'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(255, 'Title is too long'),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  currency_id: z.coerce.number().int().gt(0, 'Currency is required'),
  income_date: z.string().min(1, 'Date is required'),
  income_end_date: z.string().min(1, 'End date is required'),
  note: z.string().trim().max(1000, 'Note is too long').optional().or(z.literal(''))
}).refine(data => data.income_end_date >= data.income_date, {
  path: ['income_end_date'],
  message: 'End date must be after the start date'
})

type IncomeForm = z.output<typeof schema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const { token } = useAuth()

const incomes = ref<Income[]>([])
const sources = ref<IncomeSource[]>([])
const currencies = ref<Currency[]>([])
const isFetching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const selectedIncome = ref<Income | null>(null)
const incomeToDelete = ref<Income | null>(null)
const search = ref('')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})
const currentMonthRange = getCurrentMonthRange()

const state = reactive<IncomeForm>({
  income_source_id: 0,
  title: '',
  amount: 0,
  currency_id: 0,
  income_date: currentMonthRange.start,
  income_end_date: currentMonthRange.end,
  note: ''
})

const sourceItems = computed(() => sources.value
  .filter(source => source.is_active || source.id === selectedIncome.value?.income_source_id)
  .map(source => ({ label: source.name, value: source.id })))
const defaultCurrencyId = computed(() => currencies.value.find(currency => currency.code === 'USD')?.id ?? currencies.value[0]?.id ?? 0)
const modalTitle = computed(() => selectedIncome.value ? 'Edit income' : 'New income')
const modalDescription = computed(() => selectedIncome.value ? 'Update this income record.' : 'Record money received from an income source.')
const submitLabel = computed(() => selectedIncome.value ? 'Save changes' : 'Create income')
const filteredIncomes = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return incomes.value

  return incomes.value.filter(income =>
    income.title.toLowerCase().includes(q)
    || (income.note ?? '').toLowerCase().includes(q)
    || (income.source?.name ?? '').toLowerCase().includes(q)
  )
})

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({
    title: fallback,
    description,
    icon: 'i-lucide-alert-circle',
    color: 'error'
  })
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  }
}

function resetForm(income?: Income) {
  const defaultRange = getCurrentMonthRange()

  selectedIncome.value = income ?? null
  state.income_source_id = income?.income_source_id ?? (sourceItems.value[0]?.value ?? 0)
  state.title = income?.title ?? ''
  state.amount = Number(income?.currency_amount ?? income?.amount ?? 0)
  state.currency_id = income?.currency_id ?? defaultCurrencyId.value
  state.income_date = toDateInput(income?.income_date) || defaultRange.start
  state.income_end_date = toDateInput(income?.income_end_date) || defaultRange.end
  state.note = income?.note ?? ''
}

function formatIncomePeriod(income: Income) {
  const start = formatDate(income.income_date)
  const end = income.income_end_date ? formatDate(income.income_end_date) : start

  return start === end ? start : `${start} - ${end}`
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(income: Income) {
  resetForm(income)
  modalOpen.value = true
}

function openDeleteModal(income: Income) {
  incomeToDelete.value = income
  deleteOpen.value = true
}

async function loadData() {
  if (!token.value) return

  isFetching.value = true

  try {
    const [incomeResponse, sourceResponse, currencyResponse] = await Promise.all([
      apiFetch<ListResponse<Income>>('/incomes', { token: token.value }),
      apiFetch<ListResponse<IncomeSource>>('/income-sources', { token: token.value }),
      apiFetch<ListResponse<Currency>>('/currencies', { token: token.value })
    ])

    incomes.value = incomeResponse.data
    sources.value = sourceResponse.data
    currencies.value = currencyResponse.data
    resetForm(selectedIncome.value ?? undefined)
  } catch (error) {
    showError(error, 'Unable to load incomes')
  } finally {
    isFetching.value = false
  }
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  if (!token.value) return

  isSaving.value = true

  try {
    const data = schema.parse(event.data)
    const income = selectedIncome.value
    const response = await apiFetch<DataResponse<Income>>(
      income ? `/incomes/${income.id}` : '/incomes',
      {
        method: income ? 'PUT' : 'POST',
        token: token.value,
        body: {
          income_source_id: data.income_source_id,
          title: data.title,
          amount: data.amount,
          currency_id: data.currency_id,
          income_date: data.income_date,
          income_end_date: data.income_end_date,
          note: data.note || null
        }
      }
    )

    incomes.value = income
      ? incomes.value.map(item => item.id === response.data.id ? response.data : item)
      : [response.data, ...incomes.value]
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedIncome.value ? 'Unable to update income' : 'Unable to create income')
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!token.value || !incomeToDelete.value) return

  isDeleting.value = true

  try {
    const income = incomeToDelete.value
    const response = await apiFetch<{ message: string }>(`/incomes/${income.id}`, {
      method: 'DELETE',
      token: token.value
    })

    incomes.value = incomes.value.filter(item => item.id !== income.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    incomeToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete income')
  } finally {
    isDeleting.value = false
  }
}

function getRowItems(row: Row<Income>): DropdownMenuItem[][] {
  return [[{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditModal(row.original)
  }], [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error',
    onSelect: () => openDeleteModal(row.original)
  }]]
}

const columns: TableColumn<Income>[] = [{
  accessorKey: 'title',
  header: 'Income',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.note || 'No note')
  ])
}, {
  accessorKey: 'source.name',
  header: 'Source',
  cell: ({ row }) => h(UBadge, { variant: 'subtle', color: 'neutral' }, () => row.original.source?.name ?? '-')
}, {
  accessorKey: 'amount',
  header: 'Amount',
  cell: ({ row }) => h('div', undefined, [
    h('p', { class: 'font-medium text-success' }, formatOriginalCurrency(
      row.original.amount,
      row.original.currency_amount,
      row.original.currency
    )),
    h('p', { class: 'text-xs text-muted' }, row.original.currency
      ? `Base: ${formatCurrency(row.original.amount)} @ ${row.original.exchange_rate}`
      : 'Base currency')
  ])
}, {
  accessorKey: 'income_date',
  header: 'Period',
  cell: ({ row }) => formatIncomePeriod(row.original)
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

onMounted(loadData)
</script>

<template>
  <UDashboardPanel id="incomes">
    <template #header>
      <UDashboardNavbar title="Incomes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New income"
            icon="i-lucide-plus"
            :disabled="!sources.length"
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
          placeholder="Search incomes"
          class="w-full sm:max-w-sm"
        />
      </div>

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="filteredIncomes"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      >
        <template #empty>
          <div class="py-10 text-center">
            <UIcon name="i-lucide-trending-up" class="mx-auto mb-2 size-8 text-muted" />
            <p class="font-medium text-highlighted">
              No incomes found
            </p>
            <p class="text-sm text-muted">
              Add income sources before recording income.
            </p>
          </div>
        </template>
      </UTable>

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredIncomes.length }} income record{{ filteredIncomes.length === 1 ? '' : 's' }}
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
    <UFormField
      label="Source"
      name="income_source_id"
      required
    >
      <USelect
        v-model="state.income_source_id"
        :items="sourceItems"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Title"
      name="title"
      required
    >
      <UInput
        v-model="state.title"
        placeholder="Monthly salary"
        class="w-full"
        autofocus
      />
    </UFormField>

    <CurrencyAmountCalculator
      v-model:amount="state.amount"
      v-model:currency-id="state.currency_id"
      :currencies="currencies"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Date range"
        name="income_date"
        required
      >
        <ReportDatePicker
          v-model="state.income_date"
          v-model:end="state.income_end_date"
        />
      </UFormField>
    </div>

    <UFormField
      label="Note"
      name="note"
    >
      <UTextarea
        v-model="state.note"
        :rows="4"
        class="w-full"
      />
    </UFormField>
  </ResourceFormModal>

  <DeleteConfirmModal
    v-model:open="deleteOpen"
    title="Delete income"
    :description="`Delete ${incomeToDelete?.title ?? 'this income'}? This cannot be undone.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />
</template>
