'use client'

import { useState } from 'react'
import CalendarioComunicazioni from '@/components/CalendarioComunicazioni'

type CalRequest = {
  id: string
  start_date: string
  end_date: string
  hours: number | null
  status: string
  notes: string | null
  leave_types: { name: string; color: string } | null
}

type View = 'lista' | 'calendario'

export default function DashboardView({
  requests,
  children,
}: {
  requests: CalRequest[]
  children: React.ReactNode
}) {
  const [view, setView] = useState<View>('lista')

  return (
    <>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-4">
        <button
          onClick={() => setView('lista')}
          className={`flex flex-1 sm:flex-none items-center justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lista
        </button>
        <button
          onClick={() => setView('calendario')}
          className={`flex flex-1 sm:flex-none items-center justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'calendario' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Calendario
        </button>
      </div>

      {view === 'calendario' ? <CalendarioComunicazioni requests={requests} /> : children}
    </>
  )
}
