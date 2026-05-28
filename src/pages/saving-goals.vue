<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../utils/api'
import { formatCurrency, formatDate, toDateInput } from '../utils/money'
import { useAuth } from '../composables/useAuth'
import type {
  DataResponse,
  Currency,
  ListResponse,
  SavingGoal,
  SavingGoalStatus,
  SavingTransaction,
  SavingTransactionType
} from '../types/money'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  target_amount: z.coerce.number().gt(0, 'Target amount must be greater than 0'),
  currency_id: z.coerce.number().int().gt(0, 'Currency is required'),
  start_date: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'completed', 'cancelled']),
  note: z.string().trim().max(1000, 'Note is too long').optional().or(z.literal(''))
}).refine(data => !data.start_date || !data.deadline || data.deadline >= data.start_date, {
  path: ['deadline'],
  message: 'Deadline must be after the start date'
})

const transactionSchema = z.object({
  type: z.enum(['deposit', 'withdraw']),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  currency_id: z.coerce.number().int().gt(0, 'Currency is required'),
  transaction_date: z.string().min(1, 'Date is required'),
  note: z.string().trim().max(1000, 'Note is too long').optional().or(z.literal(''))
})

type SavingGoalForm = z.output<typeof schema>
type TransactionForm = z.output<typeof transactionSchema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UProgress = resolveComponent('UProgress')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const transactionTable = useTemplateRef('transactionTable')
const { token } = useAuth()

const goals = ref<SavingGoal[]>([])
const transactions = ref<SavingTransaction[]>([])
const currencies = ref<Currency[]>([])
const isFetching = ref(false)
const isFetchingTransactions = ref(false)
const isSaving = ref(false)
const isSavingTransaction = ref(false)
const isDeleting = ref(false)
const isDeletingTransaction = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const transactionsOpen = ref(false)
const transactionModalOpen = ref(false)
const transactionDeleteOpen = ref(false)
const selectedGoal = ref<SavingGoal | null>(null)
const goalToDelete = ref<SavingGoal | null>(null)
const currentGoal = ref<SavingGoal | null>(null)
const selectedTransaction = ref<SavingTransaction | null>(null)
const transactionToDelete = ref<SavingTransaction | null>(null)
const search = ref('')
const statusFilter = ref<'all' | SavingGoalStatus>('all')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})
const transactionPagination = ref({
  pageIndex: 0,
  pageSize: 5
})

const state = reactive<SavingGoalForm>({
  name: '',
  target_amount: 0,
  currency_id: 0,
  start_date: '',
  deadline: '',
  status: 'active',
  note: ''
})

const transactionState = reactive<TransactionForm>({
  type: 'deposit',
  amount: 0,
  currency_id: 0,
  transaction_date: toDateInput(new Date().toISOString()),
  note: ''
})

const statusItems = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
]
const transactionTypeItems = [
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdraw', value: 'withdraw' }
]
const defaultCurrencyId = computed(() => currencies.value.find(currency => currency.code === 'USD')?.id ?? currencies.value[0]?.id ?? 0)
const modalTitle = computed(() => selectedGoal.value ? 'Edit saving goal' : 'New saving goal')
const modalDescription = computed(() => selectedGoal.value ? 'Update this saving goal.' : 'Create a target for money you want to save.')
const submitLabel = computed(() => selectedGoal.value ? 'Save changes' : 'Create goal')
const transactionModalTitle = computed(() => selectedTransaction.value ? 'Edit transaction' : 'New transaction')
const transactionSubmitLabel = computed(() => selectedTransaction.value ? 'Save changes' : 'Create transaction')
const filteredGoals = computed(() => {
  const q = search.value.trim().toLowerCase()

  return goals.value.filter((goal) => {
    const matchesSearch = !q
      || goal.name.toLowerCase().includes(q)
      || (goal.note ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all' || goal.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

const transactionTotal = computed(() => transactions.value.reduce((total, transaction) => {
  const amount = Number(transaction.amount)

  return transaction.type === 'withdraw' ? total - amount : total + amount
}, 0))

function statusColor(status: SavingGoalStatus) {
  return {
    active: 'primary',
    completed: 'success',
    cancelled: 'neutral'
  }[status] as 'primary' | 'success' | 'neutral'
}

function transactionColor(type: SavingTransactionType) {
  return type === 'withdraw' ? 'error' : 'success'
}

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({ title: fallback, description, icon: 'i-lucide-alert-circle', color: 'error' })
}

function resetForm(goal?: SavingGoal) {
  selectedGoal.value = goal ?? null
  state.name = goal?.name ?? ''
  state.target_amount = Number(goal?.target_currency_amount ?? goal?.target_amount ?? 0)
  state.currency_id = goal?.currency_id ?? defaultCurrencyId.value
  state.start_date = toDateInput(goal?.start_date)
  state.deadline = toDateInput(goal?.deadline)
  state.status = goal?.status ?? 'active'
  state.note = goal?.note ?? ''
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(goal: SavingGoal) {
  resetForm(goal)
  modalOpen.value = true
}

function openDeleteModal(goal: SavingGoal) {
  goalToDelete.value = goal
  deleteOpen.value = true
}

function resetTransactionForm(transaction?: SavingTransaction) {
  selectedTransaction.value = transaction ?? null
  transactionState.type = transaction?.type ?? 'deposit'
  transactionState.amount = Number(transaction?.currency_amount ?? transaction?.amount ?? 0)
  transactionState.currency_id = transaction?.currency_id ?? defaultCurrencyId.value
  transactionState.transaction_date = toDateInput(transaction?.transaction_date) || toDateInput(new Date().toISOString())
  transactionState.note = transaction?.note ?? ''
}

async function openTransactionsModal(goal: SavingGoal) {
  currentGoal.value = goal
  transactionsOpen.value = true
  await loadTransactions(goal)
}

function openCreateTransactionModal() {
  resetTransactionForm()
  transactionModalOpen.value = true
}

function openEditTransactionModal(transaction: SavingTransaction) {
  resetTransactionForm(transaction)
  transactionModalOpen.value = true
}

function openDeleteTransactionModal(transaction: SavingTransaction) {
  transactionToDelete.value = transaction
  transactionDeleteOpen.value = true
}

async function loadGoals() {
  if (!token.value) return

  isFetching.value = true

  try {
    const [goalResponse, currencyResponse] = await Promise.all([
      apiFetch<ListResponse<SavingGoal>>('/saving-goals', { token: token.value }),
      apiFetch<ListResponse<Currency>>('/currencies', { token: token.value })
    ])

    goals.value = goalResponse.data
    currencies.value = currencyResponse.data
  } catch (error) {
    showError(error, 'Unable to load saving goals')
  } finally {
    isFetching.value = false
  }
}

async function loadTransactions(goal = currentGoal.value) {
  if (!token.value || !goal) return

  isFetchingTransactions.value = true

  try {
    const response = await apiFetch<ListResponse<SavingTransaction>>(`/saving-goals/${goal.id}/transactions`, {
      token: token.value
    })

    transactions.value = response.data
  } catch (error) {
    showError(error, 'Unable to load saving transactions')
  } finally {
    isFetchingTransactions.value = false
  }
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  if (!token.value) return

  isSaving.value = true

  try {
    const data = schema.parse(event.data)
    const goal = selectedGoal.value
    const response = await apiFetch<DataResponse<SavingGoal>>(
      goal ? `/saving-goals/${goal.id}` : '/saving-goals',
      {
        method: goal ? 'PUT' : 'POST',
        token: token.value,
        body: {
          name: data.name,
          target_amount: data.target_amount,
          currency_id: data.currency_id,
          start_date: data.start_date || null,
          deadline: data.deadline || null,
          status: data.status,
          note: data.note || null
        }
      }
    )

    goals.value = goal
      ? goals.value.map(item => item.id === response.data.id ? response.data : item)
      : [response.data, ...goals.value]
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedGoal.value ? 'Unable to update saving goal' : 'Unable to create saving goal')
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!token.value || !goalToDelete.value) return

  isDeleting.value = true

  try {
    const goal = goalToDelete.value
    const response = await apiFetch<{ message: string }>(`/saving-goals/${goal.id}`, {
      method: 'DELETE',
      token: token.value
    })

    goals.value = goals.value.filter(item => item.id !== goal.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    goalToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete saving goal')
  } finally {
    isDeleting.value = false
  }
}

function applyGoalUpdate(goal?: SavingGoal) {
  if (!goal) return

  goals.value = goals.value.map(item => item.id === goal.id ? goal : item)

  if (currentGoal.value?.id === goal.id) {
    currentGoal.value = goal
  }
}

async function onTransactionSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  if (!token.value || !currentGoal.value) return

  isSavingTransaction.value = true

  try {
    const data = transactionSchema.parse(event.data)
    const transaction = selectedTransaction.value
    const response = await apiFetch<DataResponse<SavingTransaction>>(
      transaction ? `/saving-transactions/${transaction.id}` : `/saving-goals/${currentGoal.value.id}/transactions`,
      {
        method: transaction ? 'PUT' : 'POST',
        token: token.value,
        body: {
          type: data.type,
          amount: data.amount,
          currency_id: data.currency_id,
          transaction_date: data.transaction_date,
          note: data.note || null
        }
      }
    )

    transactions.value = transaction
      ? transactions.value.map(item => item.id === response.data.id ? response.data : item)
      : [response.data, ...transactions.value]
    applyGoalUpdate(response.data.goal)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    transactionModalOpen.value = false
    resetTransactionForm()
  } catch (error) {
    showError(error, selectedTransaction.value ? 'Unable to update saving transaction' : 'Unable to create saving transaction')
  } finally {
    isSavingTransaction.value = false
  }
}

async function confirmDeleteTransaction() {
  if (!token.value || !transactionToDelete.value) return

  isDeletingTransaction.value = true

  try {
    const transaction = transactionToDelete.value
    const response = await apiFetch<{ message: string }>(`/saving-transactions/${transaction.id}`, {
      method: 'DELETE',
      token: token.value
    })

    transactions.value = transactions.value.filter(item => item.id !== transaction.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    transactionDeleteOpen.value = false
    transactionToDelete.value = null
    await loadGoals()

    if (currentGoal.value) {
      const refreshedGoal = goals.value.find(goal => goal.id === currentGoal.value?.id)
      currentGoal.value = refreshedGoal ?? currentGoal.value
    }
  } catch (error) {
    showError(error, 'Unable to delete saving transaction')
  } finally {
    isDeletingTransaction.value = false
  }
}

function getRowItems(row: Row<SavingGoal>): DropdownMenuItem[][] {
  return [[{
    label: 'Transactions',
    icon: 'i-lucide-list-plus',
    onSelect: () => openTransactionsModal(row.original)
  }, {
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

function getTransactionRowItems(row: Row<SavingTransaction>): DropdownMenuItem[][] {
  return [[{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditTransactionModal(row.original)
  }], [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error',
    onSelect: () => openDeleteTransactionModal(row.original)
  }]]
}

const columns: TableColumn<SavingGoal>[] = [{
  accessorKey: 'name',
  header: 'Goal',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.name),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.note || 'No note')
  ])
}, {
  accessorKey: 'progress',
  header: 'Progress',
  cell: ({ row }) => h('div', { class: 'min-w-36 space-y-1' }, [
    h('div', { class: 'flex items-center justify-between text-xs text-muted' }, [
      h('span', `${row.original.progress}%`),
      h('span', `${formatCurrency(row.original.current_amount)} / ${formatCurrency(row.original.target_amount)}`)
    ]),
    h(UProgress, { modelValue: row.original.progress, max: 100 }),
    h('p', { class: 'text-xs text-muted' }, row.original.currency
      ? `Target: ${formatCurrency(row.original.target_currency_amount, row.original.currency.code)} @ ${row.original.exchange_rate}`
      : 'Base currency')
  ])
}, {
  accessorKey: 'deadline',
  header: 'Deadline',
  cell: ({ row }) => formatDate(row.original.deadline)
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => h(UBadge, {
    class: 'capitalize',
    color: statusColor(row.original.status),
    variant: 'subtle'
  }, () => row.original.status)
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

const transactionColumns: TableColumn<SavingTransaction>[] = [{
  accessorKey: 'type',
  header: 'Type',
  cell: ({ row }) => h(UBadge, {
    class: 'capitalize',
    color: transactionColor(row.original.type),
    variant: 'subtle'
  }, () => row.original.type)
}, {
  accessorKey: 'amount',
  header: 'Amount',
  cell: ({ row }) => h('div', undefined, [
    h('p', {
      class: row.original.type === 'withdraw' ? 'font-medium text-error' : 'font-medium text-success'
    }, formatCurrency(row.original.amount)),
    h('p', { class: 'text-xs text-muted' }, row.original.currency
      ? `${formatCurrency(row.original.currency_amount, row.original.currency.code)} @ ${row.original.exchange_rate}`
      : 'Base currency')
  ])
}, {
  accessorKey: 'transaction_date',
  header: 'Date',
  cell: ({ row }) => formatDate(row.original.transaction_date)
}, {
  accessorKey: 'note',
  header: 'Note',
  cell: ({ row }) => row.original.note || '-'
}, {
  id: 'actions',
  cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
    items: getTransactionRowItems(row),
    content: { align: 'end' }
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    class: 'ml-auto'
  })))
}]

onMounted(loadGoals)
</script>

<template>
  <UDashboardPanel id="saving-goals">
    <template #header>
      <UDashboardNavbar title="Saving Goals">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New goal"
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
          placeholder="Search goals"
          class="w-full sm:max-w-sm"
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All', value: 'all' },
            ...statusItems
          ]"
          class="w-full sm:w-40"
        />
      </div>

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="filteredGoals"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredGoals.length }} saving goal{{ filteredGoals.length === 1 ? '' : 's' }}
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
      label="Name"
      name="name"
      required
    >
      <UInput
        v-model="state.name"
        placeholder="Emergency fund"
        class="w-full"
        autofocus
      />
    </UFormField>

    <CurrencyAmountCalculator
      v-model:amount="state.target_amount"
      v-model:currency-id="state.currency_id"
      :currencies="currencies"
      amount-label="Target amount"
      amount-name="target_amount"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Start date"
        name="start_date"
      >
        <UInput
          v-model="state.start_date"
          type="date"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Deadline"
        name="deadline"
      >
        <UInput
          v-model="state.deadline"
          type="date"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      label="Status"
      name="status"
    >
      <USelect
        v-model="state.status"
        :items="statusItems"
        class="w-full"
      />
    </UFormField>

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
    title="Delete saving goal"
    :description="`Delete ${goalToDelete?.name ?? 'this saving goal'}? This cannot be undone.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />

  <UModal
    v-model:open="transactionsOpen"
    :title="currentGoal ? `${currentGoal.name} transactions` : 'Saving transactions'"
    description="Manage deposits and withdrawals for this saving goal."
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm text-muted">
            Net movement: {{ formatCurrency(transactionTotal) }}
          </div>

          <UButton
            label="New transaction"
            icon="i-lucide-plus"
            @click="openCreateTransactionModal"
          />
        </div>

        <UTable
          ref="transactionTable"
          v-model:pagination="transactionPagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :data="transactions"
          :columns="transactionColumns"
          :loading="isFetchingTransactions"
        >
          <template #empty>
            <div class="py-8 text-center">
              <UIcon name="i-lucide-list-plus" class="mx-auto mb-2 size-8 text-muted" />
              <p class="font-medium text-highlighted">
                No saving transactions found
              </p>
            </div>
          </template>
        </UTable>

        <div class="flex justify-end">
          <UPagination
            :default-page="(transactionTable?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="transactionTable?.tableApi?.getState().pagination.pageSize"
            :total="transactionTable?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(page: number) => transactionTable?.tableApi?.setPageIndex(page - 1)"
          />
        </div>
      </div>
    </template>
  </UModal>

  <ResourceFormModal
    v-model:open="transactionModalOpen"
    :title="transactionModalTitle"
    description="Record a deposit or withdrawal for the selected saving goal."
    :schema="transactionSchema"
    :state="transactionState"
    :submit-label="transactionSubmitLabel"
    :loading="isSavingTransaction"
    @submit="onTransactionSubmit"
  >
    <UFormField
      label="Type"
      name="type"
      required
    >
      <USelect
        v-model="transactionState.type"
        :items="transactionTypeItems"
        class="w-full"
      />
    </UFormField>

    <CurrencyAmountCalculator
      v-model:amount="transactionState.amount"
      v-model:currency-id="transactionState.currency_id"
      :currencies="currencies"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Date"
        name="transaction_date"
        required
      >
        <UInput
          v-model="transactionState.transaction_date"
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
        v-model="transactionState.note"
        :rows="4"
        class="w-full"
      />
    </UFormField>
  </ResourceFormModal>

  <DeleteConfirmModal
    v-model:open="transactionDeleteOpen"
    title="Delete saving transaction"
    :description="`Delete this ${transactionToDelete?.type ?? 'saving'} transaction? This cannot be undone.`"
    :loading="isDeletingTransaction"
    @confirm="confirmDeleteTransaction"
  />
</template>
