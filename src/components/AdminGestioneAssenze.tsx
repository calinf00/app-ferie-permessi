'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { XMark, Plus, Trash, Pencil } from '@/components/icons'
import AdminEditRequest, { type RequestToEdit } from './AdminEditRequest'
import type { UserProfile } from './AdminEditUser'

export type FullLeaveRequest = {
  id: string
  start_date: string
  end_date: string
  hours: number | null
  status: string
  notes: string | null
  admin_notes: string | null
  admin_modified: boolean
  leave_type_id: string | null
  leave_types: { name: string; color: string } | null
}

type LeaveType = { id: string; name: string; color: string }

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Confermata',
  rejected: 'Non confermata',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  rejected: 'bg-red-50 text-red-600 border border-red-100',
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysDiff(start: string, end: string) {
  const s = start.split('-').map(Number); const e = end.split('-').map(Number)
  return Math.round((new Date(e[0], e[1]-1, e[2]).getTime() - new Date(s[0], s[1]-1, s[2]).getTime()) / 86400000) + 1
}

const EMPTY_ADD = { leave_type_id: '', isPartial: false, hours: '4', start_date: '', end_date: '', status: 'approved', notes: '' }

export default function AdminGestioneAssenze({
  user,
  initialRequests,
  onClose,
}: {
  user: UserProfile & { full_name: string | null; email: string }
  initialRequests: FullLeaveRequest[]
  onClose: () => void
}) {
  const supabase = createClient()
  const router = useRouter()

  const [requests, setRequests] = useState<FullLeaveRequest[]>(initialRequests)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [addError, setAddError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingReq, setEditingReq] = useState<RequestToEdit | null>(null)

  useEffect(() => {
    supabase.from('leave_types').select('id, name, color').then(({ data }) => {
      if (data) {
        setLeaveTypes(data)
        if (!addForm.leave_type_id && data.length > 0)
          setAddForm(f => ({ ...f, leave_type_id: data[0].id }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setAdd = (k: string, v: unknown) => setAddForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoadingAdd(true)
    setAddError('')

    const res = await fetch('/api/admin/create-leave-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        leave_type_id: addForm.leave_type_id,
        start_date: addForm.start_date,
        end_date: addForm.isPartial ? addForm.start_date : addForm.end_date,
        hours: addForm.isPartial ? parseInt(addForm.hours) : null,
        status: addForm.status,
        notes: addForm.notes || null,
      }),
    })

    const data = await res.json()
    setLoadingAdd(false)

    if (!res.ok) {
      setAddError(data.error ?? 'Errore durante il salvataggio')
    } else if (data.request) {
      setRequests(prev => [data.request, ...prev])
      setAddForm({ ...EMPTY_ADD, leave_type_id: addForm.leave_type_id })
      setShowAdd(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa assenza? L\'operazione non è reversibile.')) return
    setDeletingId(id)
    await supabase.from('leave_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
    router.refresh()
  }

  const name = user.full_name ?? user.email
  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors bg-white'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

  // Group requests by year
  const byYear = requests.reduce<Record<number, FullLeaveRequest[]>>((acc, r) => {
    const y = parseInt(r.start_date.slice(0, 4))
    if (!acc[y]) acc[y] = []
    acc[y].push(r)
    return acc
  }, {})
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <>
      {editingReq && (
        <AdminEditRequest
          request={editingReq}
          onClose={() => {
            setEditingReq(null)
            // Sync local state: re-read from server happens via router.refresh() inside AdminEditRequest
          }}
        />
      )}

      <div
        className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="font-semibold text-gray-900">Gestione assenze</h3>
              <p className="text-xs text-gray-400 mt-0.5">{name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowAdd(v => !v); setAddError('') }}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${showAdd ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-gray-200 hover:bg-slate-50'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                Aggiungi
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMark className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex flex-col">
            {/* Add form */}
            {showAdd && (
              <form onSubmit={handleAdd} className="px-6 py-5 border-b border-gray-100 flex flex-col gap-4 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Nuova assenza</p>

                {/* Type */}
                <div>
                  <label className={labelCls}>Tipo di assenza</label>
                  <select value={addForm.leave_type_id} onChange={e => setAdd('leave_type_id', e.target.value)} className={inputCls} required>
                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                </div>

                {/* Mode toggle */}
                <div>
                  <label className={labelCls}>Modalità</label>
                  <div className="flex gap-0.5 bg-gray-200 p-1 rounded-xl">
                    <button type="button" onClick={() => setAdd('isPartial', false)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${!addForm.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      Giornata intera
                    </button>
                    <button type="button" onClick={() => setAdd('isPartial', true)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${addForm.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      Seleziona ore
                    </button>
                  </div>
                </div>

                {/* Dates / hours */}
                {addForm.isPartial ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Data</label>
                      <input type="date" required value={addForm.start_date} onChange={e => setAdd('start_date', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Ore</label>
                      <select value={addForm.hours} onChange={e => setAdd('hours', e.target.value)} className={inputCls}>
                        {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} {h === 1 ? 'ora' : 'ore'}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Data inizio</label>
                      <input type="date" required value={addForm.start_date} onChange={e => setAdd('start_date', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Data fine</label>
                      <input type="date" required value={addForm.end_date} onChange={e => setAdd('end_date', e.target.value)} min={addForm.start_date} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className={labelCls}>Stato</label>
                  <select value={addForm.status} onChange={e => setAdd('status', e.target.value)} className={inputCls}>
                    <option value="approved">Confermata</option>
                    <option value="pending">In attesa</option>
                    <option value="rejected">Non confermata</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>Note <span className="normal-case font-normal text-gray-400">(opzionale)</span></label>
                  <input type="text" value={addForm.notes} onChange={e => setAdd('notes', e.target.value)}
                    placeholder="Es. Ferie estive, visita medica…" className={inputCls} />
                </div>

                {addError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{addError}</p>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAdd(false)}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                    Annulla
                  </button>
                  <button type="submit" disabled={loadingAdd || !addForm.leave_type_id}
                    className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                    {loadingAdd ? 'Salvataggio…' : 'Aggiungi assenza'}
                  </button>
                </div>
              </form>
            )}

            {/* Request list */}
            <div className="px-6 py-5 flex flex-col gap-5">
              {requests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nessuna assenza registrata</p>
              ) : years.map(year => (
                <div key={year}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{year}</p>
                  <div className="flex flex-col gap-2">
                    {byYear[year]
                      .sort((a, b) => b.start_date.localeCompare(a.start_date))
                      .map(req => {
                        const color = req.leave_types?.color ?? '#CBD5E1'
                        const days = daysDiff(req.start_date, req.end_date)
                        const duration = req.hours
                          ? `${req.hours} ${req.hours === 1 ? 'ora' : 'ore'}`
                          : `${days} ${days === 1 ? 'giorno' : 'giorni'}`
                        const typeName = req.leave_types?.name ?? 'Assenza'
                        return (
                          <div key={req.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800">{typeName}</span>
                                <span className="text-xs text-gray-400">{duration}</span>
                              </div>
                              <p className="text-xs text-gray-500 leading-tight">
                                {formatDate(req.start_date)}
                                {!req.hours && req.start_date !== req.end_date && <> — {formatDate(req.end_date)}</>}
                              </p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-lg shrink-0 ${STATUS_STYLE[req.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {STATUS_LABEL[req.status] ?? req.status}
                            </span>
                            <button
                              onClick={() => setEditingReq({
                                id: req.id,
                                start_date: req.start_date,
                                end_date: req.end_date,
                                hours: req.hours,
                                status: req.status,
                                notes: req.notes,
                                admin_notes: req.admin_notes,
                                leave_types: req.leave_types,
                                profiles: { full_name: user.full_name, email: user.email },
                              })}
                              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                              title="Modifica"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(req.id)}
                              disabled={deletingId === req.id}
                              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                              title="Elimina"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
