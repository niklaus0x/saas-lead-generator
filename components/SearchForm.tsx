import { useState } from 'react'
import { SearchParams } from '@/types'

interface SearchFormProps {
  onSearch: (params: SearchParams) => void
  isSearching: boolean
}

const COUNTRIES = [
  'United States',
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso',
  'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad',
  'Comoros', 'Congo (Brazzaville)', 'Congo (Kinshasa)', 'Djibouti', 'Egypt',
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon',
  'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast',
  'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
  'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco',
  'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda',
  'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
  'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo',
  'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
]

export default function SearchForm({ onSearch, isSearching }: SearchFormProps) {
  const [formData, setFormData] = useState<SearchParams>({
    productNiche: '',
    country: '',
    industry: '',
    companySize: '1-50',
    jobTitle: 'founder OR owner OR director OR CEO'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.productNiche.trim() || !formData.country) {
      alert('Please fill in Product/Niche and Country fields')
      return
    }
    onSearch(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product / Niche <span className="text-red-500">*</span></label>
            <input type="text" name="productNiche" value={formData.productNiche} onChange={handleChange}
              placeholder="e.g., digital marketing agency, creative agency, web design"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Country <span className="text-red-500">*</span></label>
            <select name="country" value={formData.country} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select a country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" name="industry" value={formData.industry} onChange={handleChange}
              placeholder="e.g., Healthcare, Finance, E-commerce"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Size <span className="text-gray-400 text-xs">(optional)</span></label>
            <select name="companySize" value={formData.companySize} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Any size</option>
              <option value="1-10">1–10 (micro agency / solo)</option>
              <option value="1-50">1–50 (small team)</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-500">201–500 employees</option>
              <option value="1000+">1000+ employees</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Job Title <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange}
              placeholder="e.g., founder, owner, CEO, director, agency head"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <button type="submit" disabled={isSearching}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors flex items-center gap-2">
            {isSearching ? (
              <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Searching...</>
            ) : <>🔍 Find Leads</>}
          </button>
        </div>
      </form>
    </div>
  )
}
