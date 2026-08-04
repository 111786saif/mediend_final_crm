'use client'

import { ProtectedRoute } from '@/components/protected-route'
import PaymentVerificationView from '@/components/finance/payment-installments/payment-verification-view'

export default function FinancePaymentVerificationsPage() {
  return (
    <ProtectedRoute>
      <div className="p-6">
        <PaymentVerificationView />
      </div>
    </ProtectedRoute>
  )
}
