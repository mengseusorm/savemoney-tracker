<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

defineProps<{
  title: string
  description?: string
  schema: unknown
  state: object
  submitLabel: string
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  submit: [event: FormSubmitEvent<Record<string, unknown>>]
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="emit('submit', $event)"
      >
        <slot />

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="submitLabel"
            :loading="loading"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
