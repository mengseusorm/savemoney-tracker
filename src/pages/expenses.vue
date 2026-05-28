<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../utils/api'
import { formatCurrency, formatDate, toDateInput } from '../utils/money'
import { useAuth } from '../composables/useAuth'
import type { Currency, DataResponse, Expense, ExpenseCategory, ListResponse } from '../types/money'

const schema = z.object({
  expense_category_id: z.coerce.number().int().gt(0, 'Category is required'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(255, 'Title is too long'),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  currency_id: z.coerce.number().int().gt(0, 'Currency is required'),
  expense_date: z.string().min(1, 'Date is required'),
  note: z.string().trim().max(1000, 'Note is too long').optional().or(z.literal(''))
})

type ExpenseForm = z.output<typeof schema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const { token } = useAuth()

const expenses = ref<Expense[]>([])
const categories = ref<ExpenseCategory[]>([])
const currencies = ref<Currency[]>([])
const isFetching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const selectedExpense = ref<Expense | null>(null)
const expenseToDelete = ref<Expense | null>(null)
const search = ref('')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const state = reactive<ExpenseForm>({
  expense_category_id: 0,
  title: '',
  amount: 0,
  currency_id: 0,
  expense_date: toDateInput(new Date().toISOString()),
  note: ''
})

const categoryItems = computed(() => categories.value
  .filter(category => category.is_active || category.id === selectedExpense.value?.expense_category_id)
  .map(category => ({ label: category.name, value: category.id })))
const defaultCurrencyId = computed(() => currencies.value.find(currency => currency.code === 'USD')?.id ?? currencies.value[0]?.id ?? 0)
const modalTitle = computed(() => selectedExpense.value ? 'Edit expense' : 'New expense')
const modalDescription = computed(() => selectedExpense.value ? 'Update this expense record.' : 'Record money spent in a category.')
const submitLabel = computed(() => selectedExpense.value ? 'Save changes' : 'Create expense')
const filteredExpenses = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return expenses.value

  return expenses.value.filter(expense =>
    expense.title.toLowerCase().includes(q)
    || (expense.note ?? '').toLowerCase().includes(q)
    || (expense.category?.name ?? '').toLowerCase().includes(q)
  )
})

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({ title: fallback, description, icon: 'i-lucide-alert-circle', color: 'error' })
}

function resetForm(expense?: Expense) {
  selectedExpense.value = expense ?? null
  state.expense_category_id = expense?.expense_category_id ?? (categoryItems.value[0]?.value ?? 0)
  state.title = expense?.title ?? ''
  state.amount = Number(expense?.currency_amount ?? expense?.amount ?? 0)
  state.currency_id = expense?.currency_id ?? defaultCurrencyId.value
  state.expense_date = toDateInput(expense?.expense_date) || toDateInput(new Date().toISOString())
  state.note = expense?.note ?? ''
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(expense: Expense) {
  resetForm(expense)
  modalOpen.value = true
}

function openDeleteModal(expense: Expense) {
  expenseToDelete.value = expense
  deleteOpen.value = true
}

async function loadData() {
  if (!token.value) return

  isFetching.value = true

  try {
    const [expenseResponse, categoryResponse, currencyResponse] = await Promise.all([
      apiFetch<ListResponse<Expense>>('/expenses', { token: token.value }),
      apiFetch<ListResponse<ExpenseCategory>>('/expense-categories', { token: token.value }),
      apiFetch<ListResponse<Currency>>('/currencies', { token: token.value })
    ])

    expenses.value = expenseResponse.data
    categories.value = categoryResponse.data
    currencies.value = currencyResponse.data
    resetForm(selectedExpense.value ?? undefined)
  } catch (error) {
    showError(error, 'Unable to load expenses')
  } finally {
    isFetching.value = false
  }
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  if (!token.value) return

  isSaving.value = true

  try {
    const data = schema.parse(event.data)
    const expense = selectedExpense.value
    const response = await apiFetch<DataResponse<Expense>>(
      expense ? `/expenses/${expense.id}` : '/expenses',
      {
        method: expense ? 'PUT' : 'POST',
        token: token.value,
        body: {
          expense_category_id: data.expense_category_id,
          title: data.title,
          amount: data.amount,
          currency_id: data.currency_id,
          expense_date: data.expense_date,
          note: data.note || null
        }
      }
    )

    expenses.value = expense
      ? expenses.value.map(item => item.id === response.data.id ? response.data : item)
      : [response.data, ...expenses.value]
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedExpense.value ? 'Unable to update expense' : 'Unable to create expense')
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!token.value || !expenseToDelete.value) return

  isDeleting.value = true

  try {
    const expense = expenseToDelete.value
    const response = await apiFetch<{ message: string }>(`/expenses/${expense.id}`, {
      method: 'DELETE',
      token: token.value
    })

    expenses.value = expenses.value.filter(item => item.id !== expense.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    expenseToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete expense')
  } finally {
    isDeleting.value = false
  }
}

function getRowItems(row: Row<Expense>): DropdownMenuItem[][] {
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

const columns: TableColumn<Expense>[] = [{
  accessorKey: 'title',
  header: 'Expense',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.note || 'No note')
  ])
}, {
  accessorKey: 'category.name',
  header: 'Category',
  cell: ({ row }) => h(UBadge, { variant: 'subtle', color: 'neutral' }, () => row.original.category?.name ?? '-')
}, {
  accessorKey: 'amount',
  header: 'Amount',
  cell: ({ row }) => h('div', undefined, [
    h('p', { class: 'font-medium text-error' }, formatCurrency(row.original.amount)),
    h('p', { class: 'text-xs text-muted' }, row.original.currency
      ? `${formatCurrency(row.original.currency_amount, row.original.currency.code)} @ ${row.original.exchange_rate}`
      : 'Base currency')
  ])
}, {
  accessorKey: 'expense_date',
  header: 'Date',
  cell: ({ row }) => formatDate(row.original.expense_date)
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
  <UDashboardPanel id="expenses">
    <template #header>
      <UDashboardNavbar title="Expenses">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New expense"
            icon="i-lucide-plus"
            :disabled="!categories.length"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search expenses"
        class="w-full sm:max-w-sm"
      />

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="filteredExpenses"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredExpenses.length }} expense record{{ filteredExpenses.length === 1 ? '' : 's' }}
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
      label="Category"
      name="expense_category_id"
      required
    >
      <USelect
        v-model="state.expense_category_id"
        :items="categoryItems"
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
        placeholder="Groceries"
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
        label="Date"
        name="expense_date"
        required
      >
        <UInput
          v-model="state.expense_date"
          type="date"
          class="w-full"
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
    title="Delete expense"
    :description="`Delete ${expenseToDelete?.title ?? 'this expense'}? This cannot be undone.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />
</template>
