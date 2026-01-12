import { apiFetch } from "@/src/lib/api/client";

export type CreateMileageEntryRequest = {
  repRouteAssignmentId: number;
  entryDate: string; // YYYY-MM-DD
  km: number;
};

export type CreatedResponse = { id: number };

export async function createMileageEntry(
  req: CreateMileageEntryRequest
): Promise<CreatedResponse> {
  return apiFetch<CreatedResponse>("/rep/mileage-entries", {
    method: "POST",
    body: req,
  });
}
