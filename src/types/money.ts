export interface Currency {
  id: number
  code: string
  name: string
  symbol: string | null
  exchange_rate: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IncomeSource {
  id: number
  user_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Income {
  id: number
  user_id: number
  income_source_id: number
  title: string
  amount: string
  currency_id: number | null
  currency_amount: string | null
  exchange_rate: string
  income_date: string
  note: string | null
  source?: IncomeSource
  currency?: Currency | null
  created_at: string
  updated_at: string
}

export interface ExpenseCategory {
  id: number
  user_id: number
  name: string
  icon: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  user_id: number
  expense_category_id: number
  title: string
  amount: string
  currency_id: number | null
  currency_amount: string | null
  exchange_rate: string
  expense_date: string
  note: string | null
  category?: ExpenseCategory
  currency?: Currency | null
  created_at: string
  updated_at: string
}

export type SavingGoalStatus = 'active' | 'completed' | 'cancelled'

export interface SavingGoal {
  id: number
  user_id: number
  name: string
  target_amount: string
  currency_id: number | null
  target_currency_amount: string | null
  exchange_rate: string
  current_amount: string
  start_date: string | null
  deadline: string | null
  status: SavingGoalStatus
  note: string | null
  progress: number
  remaining: string
  transactions_count?: number
  currency?: Currency | null
  created_at: string
  updated_at: string
}

export type SavingTransactionType = 'deposit' | 'withdraw'

export interface SavingTransaction {
  id: number
  user_id: number
  saving_goal_id: number
  type: SavingTransactionType
  amount: string
  currency_id: number | null
  currency_amount: string | null
  exchange_rate: string
  transaction_date: string
  note: string | null
  goal?: SavingGoal
  currency?: Currency | null
  created_at: string
  updated_at: string
}

export interface ListResponse<T> {
  data: T[]
}

export interface DataResponse<T> {
  message: string
  data: T
}
