// Company-related dropdown options
// Shared between SignupPage and AdminCompanySettingsPage

export const TIMEZONES = [
  { value: 'Asia/Manila', label: 'Manila (GMT+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+11)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
] as const;

export const INDUSTRIES = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'mining', label: 'Mining & Resources' },
  { value: 'logistics', label: 'Logistics & Transport' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
] as const;

export const BUSINESS_REGISTRATION_TYPES = [
  { value: 'ABN', label: 'ABN (Australian Business Number)' },
  { value: 'ACN', label: 'ACN (Australian Company Number)' },
  { value: 'NZBN', label: 'NZBN (New Zealand Business Number)' },
  { value: 'TIN', label: 'TIN (Tax Identification Number)' },
  { value: 'CRN', label: 'CRN (Company Registration Number)' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const BUSINESS_TYPES = [
  { value: 'sole_trader', label: 'Sole Trader' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'company', label: 'Company (Pty Ltd)' },
  { value: 'trust', label: 'Trust' },
  { value: 'government', label: 'Government' },
  { value: 'non_profit', label: 'Non-Profit' },
  { value: 'other', label: 'Other' },
] as const;

export const COUNTRIES = [
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'PH', label: 'Philippines' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'OTHER', label: 'Other' },
] as const;
