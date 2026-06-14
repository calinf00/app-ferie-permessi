'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XMark, Plus, Trash } from '@/components/icons'
import type { Holiday } from './AdminPresenzeGrid'

const IT_MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function formatHolidayDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${d} ${IT_MONTHS_FULL[m - 1]}`
}

export default function HolidayManager({
  holidays,
  onClose,
  onChange,
}: {
  holidays: Holiday[]
  onClose: () => void
  onChange: (holidays: Holiday[]) => void
}) {
  const supabase = createClient()
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function addHoliday() {
    if (!newDate || !newName.trim()) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('holidays')
      .insert({ date: newDate, name: newName.trim() })
      .select('id, date, name')
      .single()
    if (err) {
      setError(err.code === '23505' ? 'Esiste già un festivo per questa data.' : err.message)
    } else if (data) {
      onChange([...holidays, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)))
      setNewDate('')
      setNewName('')
    }
    setLoading(false)
  }

  async function deleteHoliday(id: string) {
    setDeleting(id)
    await supabase.from('holidays').delete().eq('id', id)
    onChange(holidays.filter(h => h.id !== id))
    setDeleting(null)
  }

  // Group by year
  const byYear = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    const y = parseInt(h.date.slice(0, 4))
    if (!acc[y]) acc[y] = []
    acc[y].push(h)
    return acc
  }, {})
  const years = Object.keys(byYear).map(Number).sort()

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Gestione festivi</h3>
            <p className="text-xs text-gray-400 mt-0.5">Aggiungi o rimuovi giorni festivi nazionali</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMark className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Add new holiday */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Aggiungi festivo</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-slate-500 bg-white"
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome festivo"
                onKeyDown={e => e.key === 'Enter' && addHoliday()}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-slate-500 bg-white"
              />
              <button
                onClick={addHoliday}
                disabled={!newDate || !newName.trim() || loading}
                className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Holiday list by year */}
          {years.map(year => (
            <div key={year}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{year}</p>
              <div className="flex flex-col gap-1">
                {byYear[year].map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-400 w-20 shrink-0">
                        {formatHolidayDate(h.date)}
                      </span>
                      <span className="text-sm text-gray-800">{h.name}</span>
                    </div>
                    <button
                      onClick={() => deleteHoliday(h.id)}
                      disabled={deleting === h.id}
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {holidays.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nessun festivo configurato</p>
          )}
        </div>
      </div>
    </div>
  )
}
