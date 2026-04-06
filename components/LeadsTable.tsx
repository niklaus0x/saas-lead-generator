import { useState } from 'react'
import { Lead } from '@/types'
import Papa from 'papaparse'

interface LeadsTableProps {
  leads: Lead[]
  onAddLead: (lead: Lead) => void
  onUpdateLead: (lead: Lead) => void
  onDeleteLead: (leadId: string) => void
}

export default function LeadsTable({ leads, onAddLead, onUpdateLead, onDeleteLead }: LeadsTableProps) {
  const [sortField, setSortField] = useState<keyof Lead>('companyName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Lead | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLead, setNewLead] = useState<Lead>({
    companyName: '', website: '', contactName: '', contactTitle: '',
    email: '', linkedinUrl: '', phone: '', country: '', source: 'Manual Entry'
  })

  const handleSort = (field: keyof Lead) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const sortedLeads = [...leads].sort((a, b) => {
    const aVal = a[sortField] || ''; const bVal = b[sortField] || ''
    const modifier = sortDirection === 'asc' ? 1 : -1
    return aVal > bVal ? modifier : aVal < bVal ? -modifier : 0
  })

  const handleExportCSV = () => {
    const csvData = leads.map(lead => ({
      'Company': lead.companyName, 'Website': lead.website,
      'Contact Name': lead.contactName, 'Title': lead.contactTitle,
      'Email': lead.email, 'LinkedIn': lead.linkedinUrl,
      'Phone': lead.phone, 'Country': lead.country,
      'Source': lead.source, 'Date Found': lead.dateFound || new Date().toISOString().split('T')[0]
    }))
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const SortIcon = ({ field }: { field: keyof Lead }) => {
    if (sortField !== field) return <span className="text-gray-400">↕</span>
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Leads ({leads.length})</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowAddForm(!showAddForm)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors">
            {showAddForm ? '✕ Cancel' : '+ Add Lead Manually'}
          </button>
          {leads.length > 0 && (
            <button onClick={handleExportCSV} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">📥 Export to CSV</button>
          )}
        </div>
      </div>
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">Add New Lead</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[['companyName','Company Name *'],['website','Website'],['contactName','Contact Name'],['contactTitle','Contact Title'],['email','Email'],['linkedinUrl','LinkedIn URL'],['phone','Phone'],['country','Country *'],['source','Source']].map(([field, placeholder]) => (
              <input key={field} type="text" placeholder={placeholder}
                value={(newLead as any)[field]}
                onChange={(e) => setNewLead({ ...newLead, [field]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => { if (!newLead.companyName || !newLead.country) { alert('Company name and country required'); return; } onAddLead({ ...newLead, dateFound: new Date().toISOString().split('T')[0] }); setNewLead({ companyName: '', website: '', contactName: '', contactTitle: '', email: '', linkedinUrl: '', phone: '', country: '', source: 'Manual Entry' }); setShowAddForm(false); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">Add Lead</button>
            <button onClick={() => setShowAddForm(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg">Cancel</button>
          </div>
        </div>
      )}
      {leads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center py-12">
          <p className="text-gray-500 text-lg">No leads yet. Search or add leads manually.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(['companyName','website','contactName','contactTitle','email','linkedinUrl','country'] as (keyof Lead)[]).map(field => (
                  <th key={field} onClick={() => handleSort(field)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                    {field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} <SortIcon field={field} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  {editingId === lead.id && editForm ? (
                    <>
                      {(['companyName','website','contactName','contactTitle','email','linkedinUrl','country'] as (keyof Lead)[]).map(field => (
                        <td key={field} className="px-4 py-3">
                          <input type="text" value={editForm[field] as string || ''}
                            onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { if (editForm) { onUpdateLead(editForm); setEditingId(null); setEditForm(null); } }} className="text-green-600 hover:text-green-800">✓</button>
                          <button onClick={() => { setEditingId(null); setEditForm(null); }} className="text-red-600 hover:text-red-800">✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.companyName}</td>
                      <td className="px-4 py-3 text-sm">{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{lead.contactName || <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lead.contactTitle || <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-sm">{lead.email ? <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-sm">{lead.linkedinUrl ? <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Profile</a> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{lead.country}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingId(lead.id || ''); setEditForm({ ...lead }); }} className="text-blue-600 hover:text-blue-800">✏️</button>
                          <button onClick={() => lead.id && onDeleteLead(lead.id)} className="text-red-600 hover:text-red-800">🗑️</button>
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
