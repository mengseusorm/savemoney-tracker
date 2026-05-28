<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../utils/api'
import { formatDate } from '../utils/money'
import { useAuth } from '../composables/useAuth'
import type { DataResponse, ExpenseCategory, ListResponse } from '../types/money'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  icon: z.string().trim().max(255, 'Icon is too long').optional().or(z.literal('')),
  color: z.string().trim().max(255, 'Color is too long').optional().or(z.literal('')),
  is_active: z.boolean()
})

type CategoryForm = z.output<typeof schema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const { token } = useAuth()

const categories = ref<ExpenseCategory[]>([])
const isFetching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const selectedCategory = ref<ExpenseCategory | null>(null)
const categoryToDelete = ref<ExpenseCategory | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const state = reactive<CategoryForm>({
  name: '',
  icon: '',
  color: '',
  is_active: true
})

const modalTitle = computed(() => selectedCategory.value ? 'Edit expense category' : 'New expense category')
const modalDescription = computed(() => selectedCategory.value ? 'Update this expense category.' : 'Create a category for expense tracking.')
const submitLabel = computed(() => selectedCategory.value ? 'Save changes' : 'Create category')
const filteredCategories = computed(() => {
  const q = search.value.trim().toLowerCase()

  return categories.value.filter((category) => {
    const matchesSearch = !q || category.name.toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && category.is_active)
      || (statusFilter.value === 'inactive' && !category.is_active)

    return matchesSearch && matchesStatus
  })
})

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({ title: fallback, description, icon: 'i-lucide-alert-circle', color: 'error' })
}

function resetForm(category?: ExpenseCategory) {
  selectedCategory.value = category ?? null
  state.name = category?.name ?? ''
  state.icon = category?.icon ?? ''
  state.color = category?.color ?? ''
  state.is_active = category?.is_active ?? true
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(category: ExpenseCategory) {
  resetForm(category)
  modalOpen.value = true
}

function openDeleteModal(category: ExpenseCategory) {
  categoryToDelete.value = category
  deleteOpen.value = true
}

async function loadCategories() {
  if (!token.value) return

  isFetching.value = true

  try {
    const response = await apiFetch<ListResponse<ExpenseCategory>>('/expense-categories', {
      token: token.value
    })

    categories.value = response.data
  } catch (error) {
    showError(error, 'Unable to load expense categories')
  } finally {
    isFetching.value = false
  }
}

async function saveCategory(payload: CategoryForm, category?: ExpenseCategory) {
  if (!token.value) return

  const response = await apiFetch<DataResponse<ExpenseCategory>>(
    category ? `/expense-categories/${category.id}` : '/expense-categories',
    {
      method: category ? 'PUT' : 'POST',
      token: token.value,
      body: {
        name: payload.name,
        icon: payload.icon || null,
        color: payload.color || null,
        is_active: payload.is_active
      }
    }
  )

  categories.value = category
    ? categories.value.map(item => item.id === response.data.id ? response.data : item)
    : [...categories.value, response.data].sort((a, b) => a.name.localeCompare(b.name))
  toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  isSaving.value = true

  try {
    await saveCategory(schema.parse(event.data), selectedCategory.value ?? undefined)
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedCategory.value ? 'Unable to update expense category' : 'Unable to create expense category')
  } finally {
    isSaving.value = false
  }
}

async function toggleCategoryStatus(category: ExpenseCategory) {
  try {
    await saveCategory({
      name: category.name,
      icon: category.icon ?? '',
      color: category.color ?? '',
      is_active: !category.is_active
    }, category)
  } catch (error) {
    showError(error, 'Unable to update expense category')
  }
}

async function confirmDelete() {
  if (!token.value || !categoryToDelete.value) return

  isDeleting.value = true

  try {
    const category = categoryToDelete.value
    const response = await apiFetch<{ message: string }>(`/expense-categories/${category.id}`, {
      method: 'DELETE',
      token: token.value
    })

    categories.value = categories.value.filter(item => item.id !== category.id)
    toast.add({ title: response.message, icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    categoryToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete expense category')
  } finally {
    isDeleting.value = false
  }
}

function getRowItems(row: Row<ExpenseCategory>): DropdownMenuItem[][] {
  return [[{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditModal(row.original)
  }, {
    label: row.original.is_active ? 'Mark inactive' : 'Mark active',
    icon: row.original.is_active ? 'i-lucide-eye-off' : 'i-lucide-eye',
    onSelect: () => toggleCategoryStatus(row.original)
  }], [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error',
    onSelect: () => openDeleteModal(row.original)
  }]]
}

const columns: TableColumn<ExpenseCategory>[] = [{
  accessorKey: 'name',
  header: 'Category',
  cell: ({ row }) => h('div', { class: 'flex items-center gap-3 min-w-0' }, [
    h('span', {
      class: 'inline-flex size-6 shrink-0 items-center justify-center rounded ring ring-default',
      style: { backgroundColor: row.original.color || 'transparent' }
    }, row.original.icon || ''),
    h('span', { class: 'font-medium text-highlighted truncate' }, row.original.name)
  ])
}, {
  accessorKey: 'is_active',
  header: 'Status',
  cell: ({ row }) => h(UBadge, {
    color: row.original.is_active ? 'success' : 'neutral',
    variant: 'subtle'
  }, () => row.original.is_active ? 'Active' : 'Inactive')
}, {
  accessorKey: 'created_at',
  header: 'Created',
  cell: ({ row }) => formatDate(row.original.created_at)
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

onMounted(loadCategories)
</script>

<template>
  <UDashboardPanel id="expense-categories">
    <template #header>
      <UDashboardNavbar title="Expense Categories">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New category"
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
          placeholder="Search categories"
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
        :data="filteredCategories"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredCategories.length }} categor{{ filteredCategories.length === 1 ? 'y' : 'ies' }}
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
        placeholder="Food"
        class="w-full"
        autofocus
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Icon"
        name="icon"
      >
        <UInput
          v-model="state.icon"
          placeholder="$"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Color"
        name="color"
      >
        <UInput
          v-model="state.color"
          type="color"
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
    title="Delete expense category"
    :description="`Delete ${categoryToDelete?.name ?? 'this category'}? This cannot be undone.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />
</template>
