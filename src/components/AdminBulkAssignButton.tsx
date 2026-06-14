'use client'

import { useState } from 'react'
import { Plus } from '@/components/icons'
import AdminBulkAssign from './AdminBulkAssign'

export default function AdminBulkAssignButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 active:bg-slate-950 transition-colors shrink-0"
      >
        <Plus className="w-4 h-4" />
        Assegna assenze
      </button>

      {open && <AdminBulkAssign onClose={() => setOpen(false)} />}
    </>
  )
}
