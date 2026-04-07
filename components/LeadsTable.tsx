import { useState } from 'react'
import { Lead } from '@/types'

interface LeadsTableProps { leads: Lead[]; searchGuidance?: Record<string, string> }

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-green-100 text-green-700 border-green-300' : score >= 5 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-red-100 text-red-700 border-red-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>{score}/10</span>
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const waMsg = encodeURIComponent(`Hi ${lead.ownerName || 'there'}, I came across ${lead.companyName} and wanted to reach out about CrewPay — a platform that helps businesses like yours pay contractors only after work is verified. Would you be open to a quick 10-minute chat?`)
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-gray-900 text-lg">{lead.companyName}</h2><p className="text-sm text-gray-500">{lead.source} · {lead.country}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <ScoreBadge score={lead.score || 0} />
            {lead.isDuplicate && <span className="text-xs bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded-full">Already saved</span>}
            {lead.painSignal && <span className="text-xs bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full">🔥 Pain signal</span>}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact Details</h3>
            {lead.ownerName && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">Owner</span><span className="font-medium">{lead.ownerName}</span></div>}
            {lead.email && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">Email</span><a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline break-all">{lead.email}</a></div>}
            {lead.whatsapp && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">WhatsApp</span><a href={`https://wa.me/${lead.whatsapp.replace(/[^\d]/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{lead.whatsapp}</a></div>}
            {lead.phone && !lead.whatsapp && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">Phone</span><span>{lead.phone}</span></div>}
            {lead.instagram && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">Instagram</span><a href={`https://instagram.com/${lead.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">{lead.instagram}</a></div>}
            {lead.website && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">Website</span><a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{lead.website}</a></div>}
            {lead.linkedinUrl && <div className="flex gap-2 text-sm"><span className="text-gray-500 w-20 shrink-0">LinkedIn</span><a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Search on LinkedIn</a></div>}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Outreach</h3>
            {lead.whatsapp && (<a href={`https://wa.me/${lead.whatsapp.replace(/[^\d]/g,'')}?text=${waMsg}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 w-full bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"><span>💬</span> Send WhatsApp Message</a>)}
            {lead.email && (<a href={`mailto:${lead.email}?subject=Quick question about ${lead.companyName}&body=Hi ${lead.ownerName || 'there'},%0D%0A%0D%0AI came across ${lead.companyName} and wanted to reach out about CrewPay.%0D%0A%0D%0ABest regards`} className="flex items-center gap-2 w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"><span>📧</span> Send Email</a>)}
          </div>
          {lead.emailPatterns && lead.emailPatterns.length > 0 && (<div className="space-y-2"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Email Guesses</h3><div className="space-y-1">{lead.emailPatterns.map(p=><div key={p} className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-1.5 rounded">{p}</div>)}</div></div>)}
        </div>
      </div>
    </div>
  )
}

export default function LeadsTable({ leads, searchGuidance }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filters, setFilters] = useState({ hasWhatsApp: false, hasEmail: false, minScore: 0, showDuplicates: true })
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'source'>('score')

  const filtered = leads
    .filter(l => filters.hasWhatsApp ? !!l.whatsapp : true)
    .filter(l => filters.hasEmail ? !!l.email : true)
    .filter(l => (l.score || 0) >= filters.minScore)
    .filter(l => filters.showDuplicates ? true : !l.isDuplicate)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'name') return (a.companyName || '').localeCompare(b.companyName || '')
      return (a.source || '').localeCompare(b.source || '')
    })

  const exportData = async (format: string) => {
    const res = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: filtered, format }) })
    const blob = await res.blob()
    const ext = format === 'sheets' ? 'tsv' : format
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `leads.${ext}`; a.click(); URL.revokeObjectURL(url)
  }

  if (!leads.length) return null

  return (
    <>
      {selectedLead && <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Filters:</span>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={filters.hasWhatsApp} onChange={e=>setFilters(f=>({...f,hasWhatsApp:e.target.checked}))} className="rounded" /><span>Has WhatsApp</span></label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={filters.hasEmail} onChange={e=>setFilters(f=>({...f,hasEmail:e.target.checked}))} className="rounded" /><span>Has Email</span></label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={!filters.showDuplicates} onChange={e=>setFilters(f=>({...f,showDuplicates:!e.target.checked}))} className="rounded" /><span>Hide Duplicates</span></label>
              <select value={filters.minScore} onChange={e=>setFilters(f=>({...f,minScore:parseInt(e.target.value)}))} className="text-xs border border-gray-300 rounded px-2 py-1">
                <option value={0}>Any score</option><option value={5}>Score ≥ 5</option><option value={7}>Score ≥ 7</option><option value={8}>Score ≥ 8</option>
              </select>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value as 'score'|'name'|'source')} className="text-xs border border-gray-300 rounded px-2 py-1">
                <option value="score">Sort: Score</option><option value="name">Sort: Name</option><option value="source">Sort: Source</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>exportData('csv')} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg font-medium">⬇ CSV</button>
              <button onClick={()=>exportData('json')} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg font-medium">⬇ JSON</button>
              <button onClick={()=>exportData('sheets')} className="px-3 py-1.5 text-xs bg-green-50 hover:bg-green-100 border border-green-300 text-green-700 rounded-lg font-medium">⬇ Sheets</button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Showing {filtered.length} of {leads.length} leads</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Owner</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Instagram</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(lead => (
                  <tr key={lead.id} className={`hover:bg-gray-50 cursor-pointer transition-colors ${lead.isDuplicate ? 'opacity-60' : ''}`} onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lead.logoUrl && <img src={lead.logoUrl} alt="" className="w-6 h-6 rounded object-contain" onError={e=>(e.currentTarget.style.display='none')} />}
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-1.5">{lead.companyName}{lead.painSignal && <span title="Pain signal detected" className="text-purple-500 text-xs">🔥</span>}{lead.isDuplicate && <span title="Already in saved leads" className="text-orange-400 text-xs">●</span>}</div>
                          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="text-xs text-blue-500 hover:underline truncate max-w-xs block">{lead.website.replace(/^https?:\/\//,'').substring(0,40)}</a>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={lead.score||0} /></td>
                    <td className="px-4 py-3 text-gray-700">{lead.ownerName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">{lead.email ? <a href={`mailto:${lead.email}`} onClick={e=>e.stopPropagation()} className="text-blue-600 hover:underline text-xs">{lead.email}</a> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">{lead.whatsapp ? <a href={`https://wa.me/${lead.whatsapp.replace(/[^\d]/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="text-green-600 hover:underline text-xs">{lead.whatsapp}</a> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">{lead.instagram ? <span className="text-pink-600 text-xs">{lead.instagram}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{lead.source}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs text-blue-500">View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
