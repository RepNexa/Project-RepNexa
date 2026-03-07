package com.repnexa.modules.analytics.doctor;

import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class DoctorAnalyticsController {

  private final DoctorAnalyticsService service;

  public DoctorAnalyticsController(DoctorAnalyticsService service) {
    this.service = service;
  }

  @PostMapping("/doctor-details")
  public DoctorDetailsResponse doctorDetails(@RequestBody DoctorDetailsRequest req, Authentication auth) {
    return service.doctorDetails(auth, req);
  }

  @GetMapping("/doctors/{id}/visit-log")
  public PagedResponse<DoctorVisitLogItem> doctorVisitLog(
      @PathVariable("id") long doctorId,
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "size", required = false) Integer size,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    // Defensive paging sanitization:
    // - prevents VALIDATION_ERROR for harmless client mistakes (e.g., size=80)
    // - keeps service-side validation strict but unreachable for page/size range issues
    int p = (page == null) ? 0 : Math.max(0, page);
    int s = (size == null) ? 50 : size;
    if (s < 1) s = 1;
    if (s > 50) s = 50; // keep within typical validator bounds

    return service.doctorVisitLog(auth, doctorId, fieldManagerId, p, s, dateFrom, dateTo);
  }

  public enum Period {
    THIS_MONTH,
    LAST_MONTH,
    CUSTOM
  }

  public record DoctorDetailsRequest(
      Period period,
      LocalDate dateFrom,
      LocalDate dateTo,
      List<Long> routeIds,
      Long fieldManagerId,
      Long doctorId,
      String grade
  ) {}

  public record Flags(boolean gradeNotSupported) {}

  public record DoctorRow(
      long doctorId,
      String doctorName,
      long visitCount,
      LocalDate lastVisitDate
  ) {}

  public record DoctorDetailsResponse(
      List<DoctorRow> rows,
      Flags flags
  ) {}

  public record DoctorVisitLogItem(
      long callId,
      LocalDate callDate,
      long routeId,
      String routeCode,
      String routeName,
      long repUserId,
      String repUsername,
      String callType,
      List<String> productCodes
  ) {}

  public record PagedResponse<T>(
      int page,
      int size,
      long totalElements,
      int totalPages,
      List<T> items
  ) {}
}