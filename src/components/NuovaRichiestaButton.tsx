'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, XMark } from '@/components/icons'

type LeaveType = { id: string; name: string; color: string }

export default function NuovaRichiestaButton({ leaveTypes, userId }: { leaveTypes: LeaveType[]; userId: string }) {
  const [open, setOpen] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [form, setForm] = useState({
    leave_type_id: leaveTypes[0]?.id ?? '',
    start_date: '',
    end_date: '',
    hours: '2',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload: Record<string, unknown> = {
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: isPartial ? form.start_date : form.end_date,
      notes: form.notes,
      user_id: userId,
    }
    if (isPartial) payload.hours = parseInt(form.hours)
    await supabase.from('leave_requests').insert(payload)
    setLoading(false)
    setOpen(false)
    setForm(f => ({ ...f, start_date: '', end_date: '', hours: '2', notes: '' }))
    setIsPartial(false)
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setIsPartial(false)
    setForm(f => ({ ...f, start_date: '', end_date: '', hours: '2', notes: '' }))
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
