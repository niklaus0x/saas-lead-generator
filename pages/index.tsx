import { useState } from 'react'
import Head from 'next/head'
import SearchForm from '@/components/SearchForm'
import LeadsTable from '@/components/LeadsTable'
import { Lead } from '@/types'

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchGuidance, setSearchGuidance] = useState<any>(null)
  const [searchStatus, setSearchStatus] = useState('')

  const handleSearch = async (searchParams: any) => {
    setIsSearching(true)
    setSearchGuidance(null)
    setSearchStatus('Searching OpenCorporates, DuckDuckGo, Crunchbase...')
    try {
      const response = await fetch('http://localhost:3001/api/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      })
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const data = await response.json()
      if (data.searchGuidance) setSearchGuidance(data.searchGuidance)
      const newLeads = (data.leads || []).map((l: Lead, i: number) => ({ ...l, id: l.id || `lead-${Date.now()}-${i}` }))
      setLeads(newLeads)
      setSearchStatus(newLeads.length > 0 ? `Found ${newLeads.length} leads` : 'No automated results — use the manual search links below')
    } catch (error) {
      console.error('Search failed:', error)
      setSearchStatus('Search failed — is the backend running on port 3001?')
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddLead = (lead: Lead) => setLeads([...leads, { ...lead, id: `manual-${Date.now()}` }])
  const handleUpdateLead = (updatedLead: Lead) => setLeads(leads.map(lead => lead.id === updatedLead.id ? updatedLead : lead))
  const handleDeleteLead = (leadId: string) => setLeads(leads.filter(lead => lead.id !== leadId))

  return (
    <>
      <Head>
        <title>SaaS Lead Generator</title>
        <meta name="description" content="Find agencies and small teams across Africa & USA — 100% free" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 SaaS Lead Generator</h1>
            <p className="text-gray-600 text-lg">Find agencies & small teams across all 54 African countries + USA — 100% free, no API keys needed</p>
            <div className="mt-2 flex justify-center gap-2 flex-wrap">
              {['DuckDuckGo', 'OpenCorporates', 'Clearbit', 'DNS Validation', 'Web Scraper'].map(tool => (
                <span key={tool} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ {tool}</span>
              ))}
            </div>
          </div>
          <SearchForm onSearch={handleSearch} isSearching={isSearching} />
          {searchStatus && !isSearching && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              searchStatus.includes('Found') ? 'bg-green-50 text-green-800 border border-green-200'
              : searchStatus.includes('failed') ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>{searchStatus}</div>
          )}
          {searchGuidance && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-900 mb-3">🏢 Find Agencies & Small Teams — Open These in New Tabs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'LinkedIn People Search', url: searchGuidance.linkedinSearch, icon: '💼' },
                  { label: 'Google → LinkedIn Profiles', url: searchGuidance.googleLinkedIn, icon: '🔗' },
                  { label: 'Google Web Search', url: searchGuidance.googleSearch, icon: '🔍' },
                  { label: 'Clutch Agency Directory', url: searchGuidance.clutchUrl, icon: '🏆' },
                  { label: 'GoodFirms Directory', url: searchGuidance.goodfirmsUrl, icon: '✅' },
                  { label: 'Crunchbase Companies', url: searchGuidance.crunchbaseUrl, icon: '📊' },
                ].filter(l => l.url).map(link => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors">
                    <span>{link.icon}</span>
                    <span className="font-medium">{link.label}</span>
                    <span className="ml-auto text-blue-400">→</span>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs text-blue-700">💡 Found an agency or small team? Click <strong>+ Add Lead Manually</strong> below to save them and export to CSV.</p>
            </div>
          )}
          <LeadsTable leads={leads} onAddLead={handleAddLead} onUpdateLead={handleUpdateLead} onDeleteLead={handleDeleteLead} />
        </div>
      </main>
    </>
  )
}
