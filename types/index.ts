export interface SearchParams {
  productNiche: string;
  country: string;
  industry?: string;
  companySize?: string;
  jobTitle?: string;
}

export interface Lead {
  id: string;
  companyName: string;
  website: string;
  ownerName: string;
  contactTitle: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  linkedinUrl: string;
  logoUrl?: string;
  emailPatterns?: string[];
  country: string;
  source: string;
  dateFound: string;
  score: number;
  painSignal: boolean;
  isDuplicate?: boolean;
  snippet?: string;
}

export interface SearchResult {
  leads: Lead[];
  count: number;
  newCount: number;
  duplicateCount: number;
  searchGuidance: Record<string, string>;
  searchTermsUsed: string[];
}
