/**
 * Agreements API - Agreement acceptance and versioning
 */

import { get, post } from "./helpers";

export type AgreementType = "vendor_agreement" | "organiser_agreement";

export interface AgreementStatus {
  accepted: boolean;
  current_version: number;
  summary: string;
  document_path: string;
  accepted_at: string | null;
}

export const agreementsApi = {
  /** Check if user has accepted the latest version of an agreement */
  check: (type: AgreementType) =>
    get<AgreementStatus>(`/agreements/check/${type}`),

  /** Accept the latest version of an agreement */
  accept: (agreement_type: AgreementType) =>
    post<{ accepted: boolean; version: number }>("/agreements/accept", { agreement_type }),
};
