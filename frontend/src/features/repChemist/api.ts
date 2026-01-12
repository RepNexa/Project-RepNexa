import { apiFetch } from "@/src/lib/api/client";

export type StockStatus = "OOS" | "LOW";

export type ChemistStockFlagInput = {
  productId: number;
  status: StockStatus;
};

export type ChemistVisitInput = {
  chemistId: number;
  stockFlags: ChemistStockFlagInput[];
};

export type CreateChemistSubmissionRequest = {
  repRouteAssignmentId: number;
  visitDate: string; // YYYY-MM-DD
  visits: ChemistVisitInput[];
};

export type CreatedResponse = { id: number };

export async function createChemistSubmission(
  req: CreateChemistSubmissionRequest,
  idempotencyKey: string
): Promise<CreatedResponse> {
  return apiFetch<CreatedResponse>("/rep/chemist-submissions", {
    method: "POST",
    body: req,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
