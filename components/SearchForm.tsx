import { useState } from 'react'
import { SearchParams } from '@/types'

interface SearchFormProps { onSearch: (params: SearchParams) => void; isSearching: boolean }

const COUNTRIES = ['United States','Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo (Brazzaville)','Congo (Kinshasa)','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','Sao Tome and Principe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe']

const NICHE_GROUPS: Record<string, string[]> = {
  '🎉 Events & Entertainment': ['Event planning','Wedding planning','DJ services','MC services','Photography','Videography','Makeup','Decor','Ushering','Catering equipment hire','Entertainment agency'],
  '🍽️ Food & Hospitality': ['Catering','Restaurant','Food delivery','Bakery','Confectionery','Bar & drinks'],
  '🏢 Professional Services': ['Digital marketing','Web design','Graphic design','Printing','Consulting','Accounting','Recruitment','Training & development'],
  '🔧 Trades & Maintenance': ['Cleaning','Plumbing','Electrical','Carpentry','Air conditioning','Generator repair','Laundry service','Fumigation'],
  '🚚 Logistics & Transport': ['Logistics','Courier service','Haulage','Car rental','Moving company','Dispatch rider'],
  '👗 Fashion & Beauty': ['Tailoring','Fashion design','Hair salon','Barber','Nail salon','Spa','Boutique'],
  '🏠 Real Estate & Property': ['Real estate','Property management','Short let apartments','Construction','Interior design'],
  '📱 Tech & Media': ['Software development','App development','Social media management','Content creation','Podcast production'],
  '✈️ Travel & Tourism': ['Travel agency','Tour operator','Visa processing','Hotel','Hostel'],
  '🎓 Education & Training': ['Tutoring','Vocational training','Language school','Driving school','Music school','Dance studio'],
}

export default function SearchForm({ onSearch, isSearching }: SearchFormProps) {
  const [formData, setFormData] = useState<SearchParams>({ productNiche: '', country: 'Nigeria', industry: '', companySize: '1-50', jobTitle: 'founder OR owner OR CEO OR director' })
  const [showNichePicker, setShowNichePicker] = useState(false)

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!formData.productNiche.trim() || !formData.country) { alert('Please fill in the Niche/Service and Country fields'); return; } onSearch(formData) }
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const selectNiche = (niche: string) => { setFormData({ ...formData, productNiche: niche }); setShowNichePicker(false) }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Service / Niche <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input type="text" name="productNiche" value={formData.productNiche} onChange={handleChange} placeholder="e.g., event planning, catering, ushering, web design..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              <button type="button" onClick={() => setShowNichePicker(!showNichePicker)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 whitespace-nowrap">Browse ▾</button>
            </div>
            {showNichePicker && (
              <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg max-h-72 overflow-y-auto z-10 relative">
                {Object.entries(NICHE_GROUPS).map(([group, niches]) => (
                  <div key={group} className="p-3 border-b border-gray-100 last:border-0">
                    <p className="text-xs font-semibold text-gray-500 mb-2">{group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {niches.map(niche => <button key={niche} type="button" onClick={() => selectNiche(niche)} className="px-2.5 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full border border-blue-200 transition-colors">{niche}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
            <select name="country" value={formData.country} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select a country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Size <span className="text-gray-400 text-xs">(optional)</span></label>
            <select name="companySize" value={formData.companySize} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Any size</option>
              <option value="1-10">1–10 (solo / micro)</option>
              <option value="1-50">1–50 (small team)</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location / Keyword <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g., Lagos, Abuja, corporate events, weddings" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Role <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="e.g., owner, founder, CEO, manager" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <button type="submit" disabled={isSearching} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors flex items-center gap-2">
            {isSearching ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Searching...</>) : <>🔍 Find Teams & Businesses</>}
          </button>
        </div>
      </form>
    </div>
  )
}
