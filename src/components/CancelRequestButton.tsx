'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CancelRequestButton({
  requestId,
  userId,
  status,
}: {
  requestId: string
  userId: string
  status: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function cancelPending() {
    if (!confirm('Vuoi annullare questa comunicazione?')) return
    setLoading(true)
    await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId)
      .eq('user_id', userId)
    setLoading(false)
    router.refresh()
  }

  async function requestCancellation() {
    if (!confirm("Vuoi richiedere l'annullamento di questa comunicazione confermata?")) return
    setLoading(true)
    await supabase
      .from('leave_requests')
      .update({ status: 'cancellation_requested' })
      .eq('id', requestId)
      .eq('user_id', userId)
    setLoading(false)
    router.refresh()
  }

  if (status === 'pending') {
    return (
      <button
        onClick={cancelPending}
        disabled={loading}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors disabled:opacity-50"
      >
        Annulla
      </button>
    )
  }

  if (status === 'approved') {
    return (
      <button
        onClick={requestCancellation}
        disabled={loading}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100 transition-colors disabled:opacity-50"
      >
        Richiedi annullamento
      </button>
    )
  }

  return null
}
