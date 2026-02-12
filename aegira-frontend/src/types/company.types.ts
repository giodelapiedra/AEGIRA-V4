export interface CompanySettings {
  id: string;
  companyName: string;
  companyCode: string;
  timezone: string;
  industry: string;
  businessRegistrationType: string;
  businessRegistrationNumber: string;
  businessType: string;
  addressStreet: string;
  addressCity: string;
  addressPostalCode: string;
  addressState: string;
  addressCountry: string;
}

export interface UpdateCompanySettingsData {
  companyName?: string;
  timezone?: string;
  industry?: string;
  businessRegistrationType?: string;
  businessRegistrationNumber?: string;
  businessType?: string;
  addressStreet?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressState?: string;
  addressCountry?: string;
}
