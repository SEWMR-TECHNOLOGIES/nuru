/**
 * References API - Event Types, Service Categories, etc.
 */

import { get } from "./helpers";
import type { EventType, ServiceCategory, ServiceType, KycRequirement, Currency, Country } from "./types";

export const referencesApi = {
  /**
   * Get all event types
   */
  getEventTypes: () => get<EventType[]>("/references/event-types"),

  /**
   * Get all service categories
   */
  getServiceCategories: () => get<ServiceCategory[]>("/references/service-categories"),

  /**
   * Get service types by category
   */
  getServiceTypesByCategory: (categoryId: string) => 
    get<ServiceType[]>(`/references/service-types/category/${categoryId}`),

  /**
   * Get KYC requirements for a service type
   */
  getServiceTypeKyc: (serviceTypeId: string) => 
    get<KycRequirement[]>(`/references/service-types/${serviceTypeId}/kyc`),

  /**
   * Get all currencies
   */
  getCurrencies: () => get<Currency[]>("/references/currencies"),

  /**
   * Get all countries
   */
  getCountries: () => get<Country[]>("/references/countries"),
};
