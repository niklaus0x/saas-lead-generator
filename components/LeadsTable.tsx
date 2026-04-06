import { useState } from 'react'
import { Lead } from '@/types'
import Papa from 'papaparse'

interface LeadsTableProps {
  leads: Lead[]
  onAddLead: (lead: Lead) => void
  onUpdateLead: (lead: Lead) => void
  onDeleteLead: (leadId: string) => void
}

function toWhatsAppNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function LeadsTable({ leads, onAddLead, onUpdateLead, onDeleteLead }: LeadsTableProps) {
  const [sortField, setSortField] = useState<keyof Lead>('companyName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Lead | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState('Hi, I came across your business and would love to connect about a potential opportunity.')
  const [newLead, setNewLead] = useState<Lead>({ companyName: '', website: '', contactName: '', contactTitle: '', email: '', linkedinUrl: '', phone: '', country: '', source: 'Manual Entry' })

  const handleSort = (field: keyof Lead) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const sortedLeads = [...leads].sort((a, b) => {
    const aVal = a[sortField] || ''; const bVal = b[sortField] || ''
    const mod = sortDirection === 'asc' ? 1 : -1
    return aVal > bVal ? mod : aVal < bVal ? -mod : 0
  })

  const handleExportCSV = () => {
    const csvData = leads.map(l => ({
      'Company': l.companyName, 'Website': l.website, 'Contact Name': l.contactName,
      'Title': l.contactTitle, 'Email': l.email, 'LinkedIn': l.linkedinUrl,
      'Phone': l.phone, 'WhatsApp': l.phone ? `https://wa.me/${toWhatsAppNumber(l.phone)}` : '',
      'Country': l.country, 'Source': l.source,
      'Date Found': l.dateFound || new Date().toISOString().split('T')[0]
    }))
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const SortIcon = ({ field }: { field: keyof Lead }) => sortField !== field ? <span className="text-gray-400">↕</span> : <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Leads ({leads.length})</h2>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setShowAddForm(!showAddForm)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm">{showAddForm ? '✕ Cancel' : '+ Add Lead Manually'}</button>
          {leads.length > 0 && <button onClick={handleExportCSV} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm">📥 Export CSV</button>}
        </div>
      </div>

      {leads.some(l => l.phone) && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <label className="block text-sm font-medium text-green-900 mb-2">💬 WhatsApp Message Template</label>
          <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={2}
            className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
          <p className="text-xs text-green-700 mt-1">Pre-filled when you click 💚 WhatsApp on any lead.</p>
        </div>
      )}

      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Lead</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[['companyName','Company Name *','text'],['website','Website','url'],['contactName','Contact Name','text'],['contactTitle','Contact Title','text'],['email','Email','email'],['linkedinUrl','LinkedIn URL','url'],['phone','Phone / WhatsApp Number','tel'],['country','Country *','text'],['source','Source','text']].map(([f,p,t])=>(
              <input key={f} type={t} placeholder={p} value={(newLead as any)[f]} onChange={e=>setNewLead({...newLead,[f]:e.target.value})} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>{if(!newLead.companyName||!newLead.country){alert('Company name and country required');return;}onAddLead({...newLead,dateFound:new Date().toISOString().split('T')[0]});setNewLead({companyName:'',website:'',contactName:'',contactTitle:'',email:'',linkedinUrl:'',phone:'',country:'',source:'Manual Entry'});setShowAddForm(false);}} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm">Add Lead</button>
            <button onClick={()=>setShowAddForm(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">No leads yet — search above or add manually.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[['companyName','Company'],['website','Website'],['contactName','Contact'],['email','Email'],['phone','Phone / WhatsApp'],['country','Country'],['source','Source']].map(([f,l])=>(
                  <th key={f} onClick={()=>handleSort(f as keyof Lead)} className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">{l} <SortIcon field={f as keyof Lead}/></th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedLeads.map(lead=>(
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  {editingId===lead.id&&editForm?(
                    <>
                      {(['companyName','website','contactName','email','phone','country','source'] as (keyof Lead)[]).map(f=>(
                        <td key={f} className="px-4 py-2"><input type="text" value={editForm[f] as string||''} onChange={e=>setEditForm({...editForm,[f]:e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/></td>
                      ))}
                      <td className="px-4 py-2"><div className="flex gap-1"><button onClick={()=>{if(editForm){onUpdateLead(editForm);setEditingId(null);setEditForm(null);}}} className="text-green-600 font-bold">✓</button><button onClick={()=>{setEditingId(null);setEditForm(null);}} className="text-red-500 font-bold">✕</button></div></td>
                    </>
                  ):(
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">{lead.companyName}</td>
                      <td className="px-4 py-3 text-sm">{lead.website?<a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{lead.website.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]}</a>:<span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm"><div className="text-gray-900">{lead.contactName||<span className="text-gray-300">—</span>}</div>{lead.contactTitle&&<div className="text-xs text-gray-400">{lead.contactTitle}</div>}{lead.linkedinUrl&&<a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">LinkedIn</a>}</td>
                      <td className="px-4 py-3 text-sm">{lead.email?<a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline break-all">{lead.email}</a>:<span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm">
                        {lead.phone?(
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-800 text-xs">{lead.phone}</span>
                            <a href={`https://wa.me/${toWhatsAppNumber(lead.phone)}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium transition-colors">💚 WhatsApp</a>
                          </div>
                        ):<span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{lead.country}</td>
                      <td className="px-4 py-3 text-xs"><span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{lead.source}</span></td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditingId(lead.id||'');setEditForm({...lead});}} className="text-blue-500 hover:text-blue-700" title="Edit">✏️</button>
                          <button onClick={()=>lead.id&&onDeleteLead(lead.id)} className="text-red-400 hover:text-red-600" title="Delete">🗑️</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
