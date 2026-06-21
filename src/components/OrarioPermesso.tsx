'use client'

import { hoursFromRanges, fmtDays, type TimeRanges } from '@/lib/leave-utils'

export type OrarioValue = { mStart: string; mEnd: string; aStart: string; aEnd: string }

export const emptyOrario: OrarioValue = { mStart: '', mEnd: '', aStart: '', aEnd: '' }

export function orarioToRanges(v: OrarioValue): TimeRanges | null {
  const r: TimeRanges = {}
  if (v.mStart && v.mEnd) r.morning = { start: v.mStart, end: v.mEnd }
  if (v.aStart && v.aEnd) r.afternoon = { start: v.aStart, end: v.aEnd }
  return r.morning || r.afternoon ? r : null
}

export function rangesToOrario(tr: TimeRanges | null | undefined): OrarioValue {
  return {
    mStart: tr?.morning?.start ?? '',
    mEnd:   tr?.morning?.end ?? '',
    aStart: tr?.afternoon?.start ?? '',
    aEnd:   tr?.afternoon?.end ?? '',
  }
}

export function orarioHours(v: OrarioValue): number {
  return hoursFromRanges(orarioToRanges(v))
}

export default function OrarioPermesso({
  value,
  onChange,
}: {
  value: OrarioValue
  onChange: (v: OrarioValue) => void
}) {
  const set = (k: keyof OrarioValue, val: string) => onChange({ ...value, [k]: val })
  const total = orarioHours(value)

  const inputCls = 'w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors'
  const subLab = 'block text-[11px] font-medium text-gray-400 mb-1'

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Mattina</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={subLab}>Da</label>
            <input type="time" value={value.mStart} onChange={e => set('mStart', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={subLab}>A</label>
            <input type="time" value={value.mEnd} onChange={e => set('mEnd', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Pomeriggio</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={subLab}>Da</label>
            <input type="time" value={value.aStart} onChange={e => set('aStart', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={subLab}>A</label>
            <input type="time" value={value.aEnd} onChange={e => set('aEnd', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Totale: <span className="font-semibold text-gray-700">{fmtDays(total)} {total === 1 ? 'ora' : 'ore'}</span>
      </p>
    </div>
  )
}
