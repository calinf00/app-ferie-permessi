'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Request = {
  id: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
  leave_types: { name: string; color: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

export default function AdminRichieste({ requests }: { requests: Request[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'pending'>('pending')

  const filtered = filter === 'pending' ? requests.filter(r => r.status === 'pending') : requests

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    await supabase.from('leave_requests').update({ status }).eq('id', id)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(['pending', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f === 'pending' ? 'Da approvare' : 'Tutte'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Nessuna richiesta {filter === 'pending' ? 'in attesa' : ''}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(req => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {req.profiles?.full_name || req.profiles?.email || 'Utente'}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: req.leave_types?.color || '#6B7280' }}
                  >
                    {req.leave_types?.name}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(req.start_date).toLocaleDateString('it-IT')} — {new Date(req.end_date).toLocaleDateString('it-IT')}
                </p>
                {req.notes && <p className="text-xs text-gray-400 mt-1">{req.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {req.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => updateStatus(req.id, 'approved')}
                      className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700"
                    >
                      Approva
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, 'rejected')}
                      className="bg-red-100 text-red-700 text-sm px-4 py-1.5 rounded-lg hover:bg-red-200"
                    >
                      Rifiuta
                    </button>
                  </>
                ) : (
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLOR[req.status]}`}>
                    {STATUS_LABEL[req.status]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
