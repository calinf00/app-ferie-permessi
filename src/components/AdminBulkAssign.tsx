'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { XMark, CheckMark, UsersGroup, Building, Trash } from '@/components/icons'

type LeaveType = { id: string; name: string; color: string }
type Collaborator = {
  id: string
  full_name: string | null
  email: string
  team: string | null
  company: string | null
}

type Step = 'details' | 'recipients' | 'result'
type Mode = 'assign' | 'remove'

type ResultData =
  | { mode: 'assign'; created: number; skipped: number; skippedNames: string[] }
  | { mode: 'remove'; deleted: number; userCount: number }

function initials(c: Collaborator) {
  const name = c.full_name ?? c.email
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors bg-white'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

export default function AdminBulkAssign({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState<Step>('details')
  const [mode, setMode] = useState<Mode>('assign')
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResultData | null>(null)

  // Step 1 — details
  const [form, setForm] = useState({
    leave_type_id: '',
    isPartial: false,
    start_date: '',
    end_date: '',
    hours: '4',
    status: 'approved',
    admin_notes: '',
  })

  // Step 2 — recipient selection
  const [filterMode, setFilterMode] = useState<'all' | 'team' | 'company' | 'manual'>('all')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('leave_types').select('id, name, color'),
      supabase
        .from('profiles')
        .select('id, full_name, email, team, company')
        .eq('is_active', true)
        .order('full_name'),
    ]).then(([lt, pr]) => {
      if (lt.data) {
        setLeaveTypes(lt.data)
        setForm(f => ({ ...f, leave_type_id: lt.data![0]?.id ?? '' }))
      }
      if (pr.data) setCollaborators(pr.data as Collaborator[])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const teams = useMemo(() => [...new Set(collaborators.map(c => c.team).filter(Boolean) as string[])].sort(), [collaborators])
  const companies = useMemo(() => [...new Set(collaborators.map(c => c.company).filter(Boolean) as string[])].sort(), [collaborators])

  // Compute the effective list shown in step 2
  const visibleCollaborators = useMemo(() => {
    if (filterMode === 'team') return collaborators.filter(c => c.team === filterTeam)
    if (filterMode === 'company') return collaborators.filter(c => c.company === filterCompany)
    return collaborators
  }, [collaborators, filterMode, filterTeam, filterCompany])

  // Effective selected IDs based on mode
  const effectiveIds = useMemo((): string[] => {
    if (filterMode === 'all') return collaborators.map(c => c.id)
    if (filterMode === 'team') return visibleCollaborators.map(c => c.id)
    if (filterMode === 'company') return visibleCollaborators.map(c => c.id)
    return [...selectedIds]
  }, [filterMode, collaborators, visibleCollaborators, selectedIds])

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === visibleCollaborators.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleCollaborators.map(c => c.id)))
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setStep('details')
    setError('')
  }

  // Step 1 → 2 validation
  function goToRecipients() {
    if (mode === 'remove') {
      if (!form.start_date || !form.end_date) return
    } else {
      if (!form.leave_type_id || !form.start_date) return
      if (!form.isPartial && !form.end_date) return
    }
    setError('')
    setStep('recipients')
  }

  async function handleSubmit() {
    if (effectiveIds.length === 0) {
      setError('Seleziona almeno un collaboratore')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/bulk-create-leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: effectiveIds,
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.isPartial ? form.start_date : form.end_date,
        hours: form.isPartial ? parseInt(form.hours) : null,
        status: form.status,
        admin_notes: form.admin_notes || null,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Errore durante l\'assegnazione')
      return
    }

    const skippedNames = collaborators
      .filter(c => (data.skippedIds ?? []).includes(c.id))
      .map(c => c.full_name ?? c.email)

    setResult({ mode: 'assign', created: data.created, skipped: data.skipped, skippedNames })
    setStep('result')
    router.refresh()
  }

  async function handleRemove() {
    if (effectiveIds.length === 0) {
      setError('Seleziona almeno un collaboratore')
      return
    }
    setLoading(true)
    setError('')

    const userCount = effectiveIds.length
    const res = await fetch('/api/admin/bulk-delete-leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: effectiveIds,
        leave_type_id: form.leave_type_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Errore durante la rimozione')
      return
    }

    setResult({ mode: 'remove', deleted: data.deleted, userCount })
    setStep('result')
    router.refresh()
  }

  const selectedLeaveType = leaveTypes.find(lt => lt.id === form.leave_type_id)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{mode === 'remove' ? 'Rimozione assenze' : 'Assegnazione assenze'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'details' ? 'Passo 1 di 2 · Dettagli assenza'
                : step === 'recipients' ? 'Passo 2 di 2 · Selezione collaboratori'
                : 'Completato'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {step !== 'result' && (
              <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => switchMode('assign')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'assign' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  Assegna
                </button>
                <button type="button" onClick={() => switchMode('remove')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'remove' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  Rimuovi
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <XMark className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {step !== 'result' && (
          <div className="h-0.5 bg-gray-100 shrink-0">
            <div
              className={`h-full transition-all duration-300 ${mode === 'remove' ? 'bg-red-600' : 'bg-slate-700'}`}
              style={{ width: step === 'details' ? '50%' : '100%' }}
            />
          </div>
        )}

        <div className="overflow-y-auto flex-1">

          {/* ── STEP 1: DETAILS ── */}
          {step === 'details' && (
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Leave type */}
              <div>
                <label className={labelCls}>{mode === 'remove' ? 'Tipo di assenza da rimuovere' : 'Tipo di assenza'}</label>
                <select value={form.leave_type_id} onChange={e => set('leave_type_id', e.target.value)} className={inputCls}>
                  {mode === 'remove' && <option value="">Tutti i tipi</option>}
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>

              {/* Mode toggle (giornata/ore) — solo in assegna */}
              {mode === 'assign' && (
              <div>
                <label className={labelCls}>Modalità</label>
                <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => set('isPartial', false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!form.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    Giornata intera
                  </button>
                  <button type="button" onClick={() => set('isPartial', true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    Seleziona ore
                  </button>
                </div>
              </div>
              )}

              {/* Dates */}
              {mode === 'assign' && form.isPartial ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data</label>
                    <input type="date" value={form.start_date} required onChange={e => set('start_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Ore</label>
                    <select value={form.hours} onChange={e => set('hours', e.target.value)} className={inputCls}>
                      {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>{h} {h === 1 ? 'ora' : 'ore'}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Dal</label>
                    <input type="date" value={form.start_date} required onChange={e => set('start_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Al</label>
                    <input type="date" value={form.end_date} required min={form.start_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* Status — solo in assegna */}
              {mode === 'assign' && (
              <div>
                <label className={labelCls}>Stato</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                  <option value="approved">Confermata</option>
                  <option value="pending">In attesa di conferma</option>
                </select>
              </div>
              )}

              {/* Admin notes — solo in assegna */}
              {mode === 'assign' && (
              <div>
                <label className={labelCls}>Nota per i collaboratori <span className="normal-case font-normal text-gray-400">(opzionale)</span></label>
                <input
                  type="text"
                  value={form.admin_notes}
                  onChange={e => set('admin_notes', e.target.value)}
                  placeholder="Es. Chiusura aziendale per ponte del 2 giugno…"
                  className={inputCls}
                />
              </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={goToRecipients}
                  disabled={mode === 'remove'
                    ? (!form.start_date || !form.end_date)
                    : (!form.leave_type_id || !form.start_date || (!form.isPartial && !form.end_date))}
                  className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  Avanti →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: RECIPIENTS ── */}
          {step === 'recipients' && (
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* Summary pill */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                {selectedLeaveType && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedLeaveType.color }} />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {mode === 'remove' && !selectedLeaveType ? 'Tutti i tipi' : selectedLeaveType?.name}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {mode === 'assign' && form.isPartial
                    ? `${form.start_date} · ${form.hours}h`
                    : form.start_date === form.end_date
                      ? form.start_date
                      : `${form.start_date} → ${form.end_date}`}
                </span>
              </div>

              {/* Filter mode */}
              <div>
                <label className={labelCls}>Assegna a</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    { key: 'all', label: 'Tutti', icon: <UsersGroup className="w-3.5 h-3.5" /> },
                    { key: 'team', label: 'Per team', icon: <UsersGroup className="w-3.5 h-3.5" /> },
                    { key: 'company', label: 'Per azienda', icon: <Building className="w-3.5 h-3.5" /> },
                    { key: 'manual', label: 'Manuale', icon: <CheckMark className="w-3.5 h-3.5" /> },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setFilterMode(opt.key)
                        setSelectedIds(new Set())
                        if (opt.key === 'team' && teams.length > 0) setFilterTeam(teams[0])
                        if (opt.key === 'company' && companies.length > 0) setFilterCompany(companies[0])
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                        filterMode === opt.key
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-filter for team */}
              {filterMode === 'team' && teams.length > 0 && (
                <div>
                  <label className={labelCls}>Team</label>
                  <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={inputCls}>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* Sub-filter for company */}
              {filterMode === 'company' && companies.length > 0 && (
                <div>
                  <label className={labelCls}>Azienda</label>
                  <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className={inputCls}>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Collaborator list (manual) or preview (other modes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>
                    {filterMode === 'manual' ? 'Seleziona collaboratori' : 'Collaboratori inclusi'}
                  </label>
                  {filterMode === 'manual' && visibleCollaborators.length > 0 && (
                    <button type="button" onClick={toggleAll} className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors">
                      {selectedIds.size === visibleCollaborators.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>
                  )}
                  {filterMode !== 'manual' && (
                    <span className="text-xs font-semibold text-slate-700">{effectiveIds.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1 max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                  {visibleCollaborators.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nessun collaboratore in questo gruppo</p>
                  ) : visibleCollaborators.map(c => {
                    const isSelected = filterMode === 'manual' ? selectedIds.has(c.id) : true
                    return (
                      <div
                        key={c.id}
                        onClick={() => filterMode === 'manual' && toggleId(c.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          filterMode === 'manual' ? 'cursor-pointer hover:bg-gray-50' : ''
                        } ${isSelected && filterMode === 'manual' ? 'bg-slate-50' : ''}`}
                      >
                        {filterMode === 'manual' && (
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-slate-900 border-slate-900' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckMark className="w-2.5 h-2.5 text-white" />}
                          </div>
                        )}
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xs font-semibold shrink-0 select-none">
                          {initials(c)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate leading-tight">{c.full_name ?? c.email}</p>
                          {c.team && <p className="text-xs text-gray-400 truncate leading-tight">{c.team}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {filterMode === 'manual' && (
                  <p className="text-xs text-gray-400 mt-1.5">{selectedIds.size} selezionati</p>
                )}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={() => setStep('details')} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                  ← Indietro
                </button>
                <button
                  type="button"
                  onClick={mode === 'remove' ? handleRemove : handleSubmit}
                  disabled={loading || effectiveIds.length === 0}
                  className={`flex-1 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                    mode === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {mode === 'remove'
                    ? (loading ? 'Rimozione…' : `Rimuovi da ${effectiveIds.length} ${effectiveIds.length === 1 ? 'collaboratore' : 'collaboratori'}`)
                    : (loading ? 'Assegnazione…' : `Assegna a ${effectiveIds.length} ${effectiveIds.length === 1 ? 'collaboratore' : 'collaboratori'}`)}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: RESULT ── */}
          {step === 'result' && result && result.mode === 'assign' && (
            <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckMark className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Assegnazione completata</p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.created} {result.created === 1 ? 'assenza assegnata' : 'assenze assegnate'} con successo
                </p>
              </div>

              {result.skipped > 0 && (
                <div className="w-full bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    {result.skipped} {result.skipped === 1 ? 'collaboratore saltato' : 'collaboratori saltati'} (assenza già presente)
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {result.skippedNames.map(name => (
                      <li key={name} className="text-xs text-amber-600">· {name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Chiudi
              </button>
            </div>
          )}

          {step === 'result' && result && result.mode === 'remove' && (
            <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Rimozione completata</p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.deleted} {result.deleted === 1 ? 'assenza rimossa' : 'assenze rimosse'}
                  {' · '}
                  {result.userCount} {result.userCount === 1 ? 'collaboratore' : 'collaboratori'}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Chiudi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
