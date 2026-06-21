export type LeaveRequestForStats = {
  start_date: string
  end_date: string
  hours: number | null
  status: string
  leave_types: { name: string; color: string } | null
}

export function categorizeLeaveType(name: string): 'riposi' | 'permessi' | 'altro' {
  const n = name.toLowerCase()
  if (n.includes('riposo') || n.includes('ferie') || n.includes('riposi')) return 'riposi'
  if (n.includes('permesso') || n.includes('permessi')) return 'permessi'
  return 'altro'
}

// --- Proporzione a settimane (riposi e permessi: conta dal giorno esatto di arrivo) ---
const WEEKS_PER_YEAR = 52

// Spettanza intero anno, proporzionata alle settimane dalla data di assunzione a fine anno (vista utente)
export function calcAnnualEntitlementWeekly(annualDays: number, hireDate: string | null, year: number): number {
  const currentYear = new Date().getFullYear()
  if (year > currentYear) return 0

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  let accrualStart = yearStart
  if (hireDate) {
    const hire = new Date(hireDate)
    if (hire.getFullYear() > year) return 0
    if (hire > accrualStart) accrualStart = hire
  }

  const daysRemaining = Math.round((yearEnd.getTime() - accrualStart.getTime()) / 86400000) + 1
  const fraction = Math.min(daysRemaining / 7 / WEEKS_PER_YEAR, 1)
  return Math.round(fraction * annualDays * 10) / 10
}

// Maturato a oggi, proporzionato alle settimane dalla data di assunzione (vista admin)
export function calcAccruedWeekly(annualDays: number, hireDate: string | null, year: number): number {
  const now = new Date()
  const currentYear = now.getFullYear()
  if (year > currentYear) return 0

  const yearStart = new Date(year, 0, 1)
  let accrualStart = yearStart
  if (hireDate) {
    const hire = new Date(hireDate)
    if (hire.getFullYear() > year) return 0
    if (hire > accrualStart) accrualStart = hire
  }

  const accrualEnd = year < currentYear ? new Date(year, 11, 31) : now
  if (accrualEnd.getTime() < accrualStart.getTime()) return 0

  const daysElapsed = Math.round((accrualEnd.getTime() - accrualStart.getTime()) / 86400000) + 1
  const fraction = Math.min(daysElapsed / 7 / WEEKS_PER_YEAR, 1)
  return Math.round(fraction * annualDays * 10) / 10
}

export function calcUsedDaysInCategory(
  category: 'riposi' | 'permessi',
  requests: LeaveRequestForStats[],
  year: number
): number {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  return requests.reduce((sum, r) => {
    if (r.status !== 'approved') return sum
    const typeName = r.leave_types?.name ?? ''
    if (categorizeLeaveType(typeName) !== category) return sum

    const start = new Date(r.start_date)
    const end = new Date(r.end_date)
    if (start > yearEnd || end < yearStart) return sum

    if (r.hours !== null) {
      return sum + r.hours / 8
    }

    const clampedStart = start < yearStart ? yearStart : start
    const clampedEnd = end > yearEnd ? yearEnd : end
    return sum + Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1
  }, 0)
}

export function calcAltroByType(
  requests: LeaveRequestForStats[],
  year: number
): Array<{ name: string; color: string; days: number }> {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const map = new Map<string, { color: string; days: number }>()

  for (const r of requests) {
    if (r.status !== 'approved') continue
    const typeName = r.leave_types?.name ?? ''
    if (categorizeLeaveType(typeName) !== 'altro') continue

    const start = new Date(r.start_date)
    const end = new Date(r.end_date)
    if (start > yearEnd || end < yearStart) continue

    let days: number
    if (r.hours !== null) {
      days = r.hours / 8
    } else {
      const clampedStart = start < yearStart ? yearStart : start
      const clampedEnd = end > yearEnd ? yearEnd : end
      days = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1
    }

    const existing = map.get(typeName)
    if (existing) {
      existing.days += days
    } else {
      map.set(typeName, { color: r.leave_types?.color ?? '#94a3b8', days })
    }
  }

  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
}

export function fmtDays(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export function daysDiff(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}
