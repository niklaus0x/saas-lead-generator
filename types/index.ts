export interface Lead {
  id?: string
  companyName: string
  website: string
  contactName: string
  contactTitle: string
  email: string
  linkedinUrl: string
  phone: string
  country: string
  source: string
  dateFound?: string
}

export interface SearchParams {
  productNiche: string
  country: string
  industry?: string
  companySize?: string
  jobTitle?: string
}
