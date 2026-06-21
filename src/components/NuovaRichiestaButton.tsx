'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, XMark } from '@/components/icons'
import OrarioPermesso, { emptyOrario, orarioToRanges, orarioHours, type OrarioValue } from '@/components/OrarioPermesso'

type LeaveType = { id: string; name: string; color: string }

type Conflict = { id: string; start_date: string; end_date: string; hours: number | null; leave_types: { name: string; color: string } | null }

export default function NuovaRichiestaButton({ leaveTypes, userId }: { leaveTypes: LeaveType[]; userId: string }) {
  const [open, setOpen] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [orario, setOrario] = useState<OrarioValue>(emptyOrario)
  const [form, setForm] = useState({
    leave_type_id: leaveTypes[0]?.id ?? '',
    start_date: '',
    end_date: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const router = useRouter()
  const supabase = createClient()

  // Le ore hanno senso solo per permesso/ferie/congedo: per malattia e "altro" (giornata intera) le nascondiamo
  const typeAllowsHours = (id: string) => {
    const name = leaveTypes.find(lt => lt.id === id)?.name?.toLowerCase() ?? ''
    return !['malatt', 'altro'].some(k => name.includes(k))
  }
  const allowsHours = typeAllowsHours(form.leave_type_id)

  function changeLeaveType(id: string) {
    setForm(f => ({ ...f, leave_type_id: id }))
    if (!typeAllowsHours(id)) setIsPartial(false)
  }

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
    if (isPartial && orarioHours(orario) <= 0) {
      alert('Inserisci almeno una fascia oraria valida (mattina o pomeriggio).')
      return
    }
    setLoading(true)
    const payload: Record<string, unknown> = {
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: isPartial ? form.start_date : form.end_date,
      notes: form.notes,
      user_id: userId,
    }
    if (isPartial) {
      payload.hours = orarioHours(orario)
      payload.time_ranges = orarioToRanges(orario)
    }
    await supabase.from('leave_requests').insert(payload)
    setLoading(false)
    setOpen(false)
    setForm(f => ({ ...f, start_date: '', end_date: '', notes: '' }))
    setOrario(emptyOrario)
    setIsPartial(false)
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setIsPartial(false)
    setOrario(emptyOrario)
    setForm(f => ({ ...f, start_date: '', end_date: '', notes: '' }))
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 w-full sm:w-auto justify-center bg-slate-900 text-white rounded-xl px-4 py-2.5 sm:py-2 text-sm font-medium hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        <span>Nuova comunicazione</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="font-semibold text-gray-900">Nuova comunicazione</h3>
              <button
                onClick={handleClose}
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
                  onChange={e => changeLeaveType(e.target.value)}
                  className={inputCls}
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>

              {/* Toggle giornata intera / seleziona ore (solo per i tipi che lo prevedono) */}
              {allowsHours && (
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
                    Seleziona ore
                  </button>
                </div>
              )}

              {isPartial ? (
                <div className="flex flex-col gap-3">
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
                  <OrarioPermesso value={orario} onChange={setOrario} />
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

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Invio...' : 'Invia comunicazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
