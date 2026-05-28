<script setup lang="ts">
import * as z from 'zod'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import { ApiError } from '../utils/api'
import { useAuth } from '../composables/useAuth'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { login, isLoading } = useAuth()

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}, {
  name: 'remember',
  label: 'Remember me',
  type: 'checkbox'
}]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(1, 'Password is required')
})

const submit = computed(() => ({
  label: 'Login',
  icon: 'i-lucide-log-in'
}))

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await login({
      email: payload.data.email,
      password: payload.data.password
    })

    toast.add({
      title: 'Logged in',
      icon: 'i-lucide-check',
      color: 'success'
    })

    await router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch (error) {
    toast.add({
      title: 'Login failed',
      description: error instanceof ApiError ? error.message : 'Unable to login.',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        title="Login"
        description="Enter your credentials to access your account."
        icon="i-lucide-user"
        :fields="fields"
        :submit="submit"
        :loading="isLoading"
        @submit="onSubmit"
      />
    </UPageCard>
  </div>
</template>

<route lang="yaml">
meta:
  layout: auth
</route>
