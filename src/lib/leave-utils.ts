export type LeaveStats = {
  accrued: number
  usedDays: number
  remaining: number
  monthlyRate: number
  weeklyRate: number
  annualDays: number
}

export function calcLeaveStats(
  hireDate: string | null,
  annualDays: number = 20,
  approvedRequests: { start_date: string; end_date: string }[]
): LeaveStats {
  const now = new Date()
  const currentYear = now.getFullYear()
  const yearStart = new Date(currentYear, 0, 1)
  const hire = hireDate ? new Date(hireDate) : yearStart
  const accrualStart = hire > yearStart ? hire : yearStart

  const msElapsed = Math.max(0, now.getTime() - accrualStart.getTime())
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24)
  const yearFraction = Math.min(daysElapsed / 365.25, 1)
  const accrued = Math.round(yearFraction * annualDays * 2) / 2

  const usedDays = approvedRequests.reduce((sum, r) => {
    const start = new Date(r.start_date)
    const end = new Date(r.end_date)
    if (start.getFullYear() > currentYear || end.getFullYear() < currentYear) return sum
    const clampedStart = start.getFullYear() < currentYear ? yearStart : start
    const clampedEnd = end.getFullYear() > currentYear ? new Date(currentYear, 11, 31) : end
    return sum + Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1
  }, 0)

  const remaining = Math.max(0, Math.round((accrued - usedDays) * 2) / 2)
  const monthlyRate = Math.round((annualDays / 12) * 100) / 100
  const weeklyRate = Math.round((annualDays / 52) * 100) / 100

  return { accrued, usedDays, remaining, monthlyRate, weeklyRate, annualDays }
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
