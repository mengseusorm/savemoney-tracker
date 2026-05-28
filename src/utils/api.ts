export interface ApiValidationErrors {
  [field: string]: string[]
}

export class ApiError extends Error {
  status: number
  errors?: ApiValidationErrors

  constructor(message: string, status: number, errors?: ApiValidationErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

type JsonBody = Record<string, unknown> | unknown[]

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | JsonBody | null
  token?: string | null
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api').replace(/\/$/, '')

function isJsonBody(body: ApiRequestOptions['body']): body is JsonBody {
  return !!body
    && typeof body === 'object'
    && !(body instanceof FormData)
    && !(body instanceof URLSearchParams)
    && !(body instanceof Blob)
    && !(body instanceof ArrayBuffer)
}

async function parseResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const body = isJsonBody(options.body) ? JSON.stringify(options.body) : options.body

  headers.set('Accept', 'application/json')

  if (isJsonBody(options.body)) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    body
  })
  const data = await parseResponse(response)

  if (!response.ok) {
    throw new ApiError(
      data?.message || response.statusText || 'Request failed',
      response.status,
      data?.errors
    )
  }

  return data as T
}
