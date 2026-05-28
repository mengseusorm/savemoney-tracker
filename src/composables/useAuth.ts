import { computed, ref } from 'vue'
import { createSharedComposable, StorageSerializers, useStorage } from '@vueuse/core'
import { apiFetch } from '../utils/api'

export interface AuthUser {
  id: number
  name: string
  email: string
  email_verified_at?: string | null
  created_at?: string
  updated_at?: string
}

interface AuthResponse {
  message: string
  user: AuthUser
  token: string
}

interface LoginCredentials {
  email: string
  password: string
}

const _useAuth = () => {
  const token = useStorage<string | null>('auth-token', null)
  const user = useStorage<AuthUser | null>('auth-user', null, undefined, {
    serializer: StorageSerializers.object
  })
  const isLoading = ref(false)
  const isAuthenticated = computed(() => !!token.value)

  function clearAuth() {
    token.value = null
    user.value = null
  }

  async function login(credentials: LoginCredentials) {
    isLoading.value = true

    try {
      const response = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: credentials.email,
          password: credentials.password
        }
      })

      token.value = response.token
      user.value = response.user

      return response.user
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true

    try {
      if (token.value) {
        await apiFetch<{ message: string }>('/auth/logout', {
          method: 'POST',
          token: token.value
        })
      }
    } catch {
      // Local logout should still complete when the API token is already invalid.
    } finally {
      clearAuth()
      isLoading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) {
      clearAuth()
      return null
    }

    try {
      user.value = await apiFetch<AuthUser>('/user', {
        token: token.value
      })

      return user.value
    } catch (error) {
      clearAuth()
      throw error
    }
  }

  return {
    token,
    user,
    isLoading,
    isAuthenticated,
    clearAuth,
    login,
    logout,
    fetchUser
  }
}

export const useAuth = createSharedComposable(_useAuth)
