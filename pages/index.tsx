import { useState } from 'react'
import Head from 'next/head'
import SearchForm from '@/components/SearchForm'
import LeadsTable from '@/components/LeadsTable'
import { Lead } from '@/types'
import { apiPost } from '@/lib/api'

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchGuidance, setSearchGuidance] = useState<any>(null)
  const [searchStatus, setSearchStatus] = useState('')
  const [searchTermsUsed, setSearchTermsUsed] = useState<string[]>([])

  const handleSearch = async (searchParams: any) => {
    setIsSearching(true); setSearchGuidance(null); setSearchTermsUsed([])
    setSearchStatus('Searching web, directories, and business registries...')
    try {
      const data = await apiPost('/api/search-leads', searchParams)
      if (data.searchGuidance) setSearchGuidance(data.searchGuidance)
      if (data.searchTermsUsed) setSearchTermsUsed(data.searchTermsUsed)
      const newLeads = (data.leads || []).map((l: Lead, i: number) => ({ ...l, id: l.id || `lead-${Date.now()}-${i}` }))
      setLeads(newLeads)
      setSearchStatus(newLeads.length > 0 ? `Found ${newLeads.length} leads — plus manual search links below` : 'No automated results — use the search links below')
    } catch (err: any) {
      setSearchStatus(`Search failed — ${err.message}`)
    } finally { setIsSearching(false) }
  }

  const handleAddLead = (l: Lead) => setLeads([...leads, { ...l, id: `manual-${Date.now()}` }])
  const handleUpdateLead = (u: Lead) => setLeads(leads.map(l => l.id === u.id ? u : l))
  const handleDeleteLead = (id: string) => setLeads(leads.filter(l => l.id !== id))

  return (
    <>
      <Head><title>Lead Generator — Africa & USA</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 Lead Generator</h1>
            <p className="text-gray-600 text-lg">Find agencies, small teams & informal businesses across Africa + USA</p>
            <div className="mt-2 flex justify-center gap-2 flex-wrap">
              {['Event Planners','Caterers','Ushering','Photographers','DJs','Agencies','80+ niches'].map(t => <span key={t} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{t}</span>)}
            </div>
          </div>
          <SearchForm onSearch={handleSearch} isSearching={isSearching} />
          {searchTermsUsed.length > 0 && !isSearching && (
            <div className="mt-3 text-xs text-gray-500">Search terms used: {searchTermsUsed.map(t => <span key={t} className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">{t}</span>)}</div>
          )}
          {searchStatus && !isSearching && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${ searchStatus.includes('Found') ? 'bg-green-50 text-green-800 border border-green-200' : searchStatus.includes('failed') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200' }`}>{searchStatus}</div>
          )}
          {searchGuidance && (
            <div className="mt-6 space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <h3 className="text-base font-semibold text-purple-900 mb-3">📱 Social Media — Best for Informal Teams</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{label:'Facebook Pages',url:searchGuidance.facebook,icon:'📘'},{label:'Instagram Search',url:searchGuidance.instagram,icon:'📷'},{label:'Twitter/X Users',url:searchGuidance.twitter,icon:'🐦'},{label:'Google Maps',url:searchGuidance.googleMaps,icon:'📍'}].filter(l=>l.url).map(link=>(
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-700 hover:bg-purple-50 transition-colors">
                      <span>{link.icon}</span><span className="font-medium">{link.label}</span><span className="ml-auto text-purple-400">↗</span>
                    </a>
                  ))}
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                <h3 className="text-base font-semibold text-orange-900 mb-3">📋 Africa & Local Directories</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{label:'Yellow Pages Nigeria',url:searchGuidance.yellowPages,icon:'📒'},{label:'VConnect Africa',url:searchGuidance.vconnect,icon:'🌍'},{label:'Bark.com Nigeria',url:searchGuidance.bark,icon:'🐾'}].filter(l=>l.url).map(link=>(
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700 hover:bg-orange-50 transition-colors">
                      <span>{link.icon}</span><span className="font-medium">{link.label}</span><span className="ml-auto text-orange-400">↗</span>
                    </a>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-base font-semibold text-blue-900 mb-3">💼 Professional Networks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{label:'LinkedIn People Search',url:searchGuidance.linkedinSearch,icon:'🔗'},{label:'Google → LinkedIn Profiles',url:searchGuidance.googleLinkedIn,icon:'🌐'}].filter(l=>l.url).map(link=>(
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 transition-colors">
                      <span>{link.icon}</span><span className="font-medium">{link.label}</span><span className="ml-auto text-blue-400">↗</span>
                    </a>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">Found one? Click <strong>+ Add Lead Manually</strong> below ↓</p>
            </div>
          )}
          <LeadsTable leads={leads} onAddLead={handleAddLead} onUpdateLead={handleUpdateLead} onDeleteLead={handleDeleteLead} />
        </div>
      </main>
    </>
  )
}
