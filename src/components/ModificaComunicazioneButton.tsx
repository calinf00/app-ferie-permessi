'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, XMark } from '@/components/icons'

type LeaveType = { id: string; name: string; color: string }

type Conflict = { id: string; start_date: string; end_date: string; hours: number | null; leave_types: { name: string; color: string } | null }

type Comunicazione = {
  id: string
  leave_type_id: string
  start_date: string
  end_date: string
  hours: number | null
  notes: string | null
}

export default function ModificaComunicazioneButton({
  leaveTypes,
  comunicazione,
  userId,
  isApproved = false,
}: {
  leaveTypes: LeaveType[]
  comunicazione: Comunicazione
  userId: string
  isApproved?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPartial, setIsPartial] = useState(!!comunicazione.hours)
  const [form, setForm] = useState({
    leave_type_id: comunicazione.leave_type_id ?? leaveTypes[0]?.id ?? '',
    start_date: comunicazione.start_date ?? '',
    end_date: comunicazione.end_date ?? '',
    hours: String(comunicazione.hours ?? 2),
    notes: comunicazione.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    async function check() {
      const effectiveStart = form.start_date
      const effectiveEnd = isPartial ? form.start_date : form.end_date
      if (!effectiveStart || !effectiveEnd) {
        if (!cancelled) setConflicts([])
        return
      }
      const { data } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, hours, leave_types(name, color)')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .neq('id', comunicazione.id)
        .lte('start_date', effectiveEnd)
        .gte('end_date', effectiveStart)
      if (!cancelled) setConflicts((data as Conflict[] | null) ?? [])
    }
    check()
    return () => {
      cancelled = true
    }
  }, [form.start_date, form.end_date, isPartial, userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isApproved) {
      // Comunicazione già confermata: invia una richiesta di modifica all'admin
      const res = await fetch('/api/request-modification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: comunicazione.id,
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: isPartial ? form.start_date : form.end_date,
          hours: isPartial ? parseInt(form.hours) : null,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) {
        setError(data.error ?? 'Errore durante l\'invio della modifica')
        return
      }
      setOpen(false)
      router.refresh()
      return
    }

    await supabase
      .from('leave_requests')
      .update({
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: isPartial ? form.start_date : form.end_date,
        hours: isPartial ? parseInt(form.hours) : null,
        notes: form.notes || null,
      })
      .eq('id', comunicazione.id)
      .eq('user_id', userId)
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-200 transition-colors flex items-center gap-1"
      >
        <Pencil className="w-3.5 h-3.5" />
        {isApproved ? 'Comunica modifica' : 'Modifica'}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="font-semibold text-gray-900">{isApproved ? 'Comunica modifica' : 'Modifica comunicazione'}</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMark className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Tipo di assenza</label>
                <select
                  value={form.leave_type_id}
                  onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                  className={inputCls}
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>

              {/* Toggle giornata intera / permesso a ore */}
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsPartial(false)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${!isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  Giornata intera
                </button>
                <button
                  type="button"
                  onClick={() => setIsPartial(true)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  Permesso a ore
                </button>
              </div>

              {isPartial ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data</label>
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Ore di permesso</label>
                    <select
                      value={form.hours}
                      onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                      className={inputCls}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                        <option key={h} value={String(h)}>{h} {h === 1 ? 'ora' : 'ore'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Dal</label>
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Al</label>
                    <input
                      type="date"
                      required
                      value={form.end_date}
                      min={form.start_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {conflicts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-amber-700">
                    Attenzione: hai già {conflicts.length === 1 ? 'una comunicazione approvata' : 'comunicazioni approvate'} in questo periodo
                  </p>
                  <ul className="flex flex-col gap-1">
                    {conflicts.map(c => (
                      <li key={c.id} className="flex items-center gap-2 text-xs text-amber-600">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.leave_types?.color ?? '#f59e0b' }}
                        />
                        <span>
                          {c.leave_types?.name ?? 'Assenza'} · {' '}
                          {c.hours
                            ? `${new Date(c.start_date + 'T00:00:00').toLocaleDateString('it-IT')} (${c.hours}h)`
                            : `${new Date(c.start_date + 'T00:00:00').toLocaleDateString('it-IT')}${c.start_date !== c.end_date ? ` → ${new Date(c.end_date + 'T00:00:00').toLocaleDateString('it-IT')}` : ''}`
                          }
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-500 mt-0.5">Puoi comunque inviare la comunicazione.</p>
                </div>
              )}

              <div>
                <label className={labelCls}>Note <span className="normal-case font-normal">(opzionale)</span></label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                  placeholder="Motivazione o dettagli aggiuntivi..."
                />
              </div>

              {isApproved && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  La comunicazione è già confermata: la modifica verrà inviata all&apos;admin per la conferma. L&apos;assenza attuale resta valida finché non viene approvata.
                </p>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.leave_type_id}
                  className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Invio…' : isApproved ? 'Invia modifica' : 'Salva modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
