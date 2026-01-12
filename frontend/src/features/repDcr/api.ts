import { apiFetch } from "@/src/lib/api/client";

export type DcrDoctorCallInput = {
  doctorId: number;
  callType: string;
  productIds: number[];
};

export type DcrMissedDoctorInput = {
  doctorId: number;
  reason?: string | null;
};

export type CreateDcrSubmissionRequest = {
  repRouteAssignmentId: number;
  callDate: string; // YYYY-MM-DD
  doctorCalls: DcrDoctorCallInput[];
  missedDoctors: DcrMissedDoctorInput[];
};

export type CreatedResponse = { id: number };

export async function createDcrSubmission(
  req: CreateDcrSubmissionRequest,
  idempotencyKey: string
): Promise<CreatedResponse> {
  return apiFetch<CreatedResponse>("/rep/dcr-submissions", {
    method: "POST",
    body: req,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export type SubmissionListItem = {
  id: number;
  callDate: string;
  repRouteAssignmentId: number;
  routeId: number;
  routeName: string;
  routeCode: string;
  territoryName: string;
  submittedAt: string;
  doctorCallCount: number;
  missedCount: number;
};

export async function listDcrSubmissions(): Promise<SubmissionListItem[]> {
  return apiFetch<SubmissionListItem[]>("/rep/dcr-submissions", {
    method: "GET",
    requireCsrf: false,
  });
}
