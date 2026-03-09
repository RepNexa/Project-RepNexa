export type Period = "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";
export type Grade = "A" | "B" | "C";
export type CompanyOverviewPeriod = Period;

export type CompanyOverviewFilters = {
  period: Period;
  routeIds?: number[];
  fieldManagerId?: number;
  grade?: Grade;
  dateFrom?: string; // ISO date yyyy-mm-dd when period=CUSTOM
  dateTo?: string; // ISO date yyyy-mm-dd when period=CUSTOM
};

export type CompanyOverviewResponse = {
  periodUsed: { dateFrom: string; dateTo: string };

  coverageSelectedGrade: {
    value: number | null; // ratio 0..1
    deltaVsLastMonth: number | null; // ratio delta (can be null)
  };

  doctorsAtRisk: number | null;
  visits: number | null;
  avgDoctorVisits: number | null; // numeric (visits / totalDoctors)

  coverageByGrade: Array<{ grade: string; value: number | null }>;

  targetAchievementByRep: Array<{
    repUserId: number;
    repUsername: string;
    achievement: number | null; // ratio 0..1
  }>;

  repPerformanceTable: Array<{
    repUserId: number | null;
    repUsername: string;
    visits: number | null;
  }>;

  productCoverageMatrix: Array<{
    code: string;
    name: string;
    coverage: number | null; // ratio 0..1
  }>;

  oosByProduct: Array<{ key: string; count: number | null }>;
  oosByRoute: Array<{ key: string; count: number | null }>;

  // New (additive) fields from updated backend response.
  oosByTerritory?: Array<{ key: string; count: number | null }>;

  repPerformanceDetail?: Array<{
    repUserId: number;
    repUsername: string;
    territory: string;
    totalVisits: number;
    uniqueDoctors: number;
    aGradeVisits: number;
    bGradeVisits: number;
    cGradeVisits: number;
  }>;

  productCoverageByGrade?: Array<{
    code: string;
    name: string;
    allDoctors: number;
    aDoctors: number;
    bDoctors: number;
    cDoctors: number;
  }>;

  flags: {
    noData: boolean;
    gradeNotSupported: boolean;
    targetAchievementNa: boolean;
    repPerformanceNa: boolean;
    productCoverageMatrixNa: boolean;
    oosNa: boolean;
  };

  scope: { effectiveRouteIds: number[] };
};
