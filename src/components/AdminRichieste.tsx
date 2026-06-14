'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type LeaveRequest = {
  id: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
  leave_types: { name: string; color: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  rejected: 'bg-red-50 text-red-600 border border-red-100',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function daysDiff(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}

export default function AdminRichieste({ requests }: { requests: LeaveRequest[] }) {
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
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'pending' ? `Da approvare ${requests.filter(r => r.status === 'pending').length > 0 ? `(${requests.filter(r => r.status === 'pending').length})` : ''}` : 'Tutte'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl mb-4">✅</div>
          <p className="text-gray-700 font-medium">Nessuna richiesta {filter === 'pending' ? 'in attesa' : ''}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(req => {
            const days = daysDiff(req.start_date, req.end_date)
            const name = req.profiles?.full_name || req.profiles?.email || 'Utente'
            const initials = name.slice(0, 2).toUpperCase()
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-gray-200 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: req.leave_types?.color || '#CBD5E1' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm truncate">{name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{req.leave_types?.name}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(req.start_date)}
                        {req.start_date !== req.end_date && <> — {formatDate(req.end_date)}</>}
                        <span className="text-gray-400"> · {days} {days === 1 ? 'giorno' : 'giorni'}</span>
                      </p>
                      {req.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{req.notes}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {req.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => updateStatus(req.id, 'approved')}
                        className="bg-emerald-500 text-white text-xs px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                      >
                        Approva
                      </button>
                      <button
                        onClick={() => updateStatus(req.id, 'rejected')}
                        className="bg-red-50 text-red-600 border border-red-100 text-xs px-4 py-2 rounded-xl font-medium hover:bg-red-100 transition-colors"
                      >
                        Rifiuta
                      </button>
                    </>
                  ) : (
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${STATUS_STYLE[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
