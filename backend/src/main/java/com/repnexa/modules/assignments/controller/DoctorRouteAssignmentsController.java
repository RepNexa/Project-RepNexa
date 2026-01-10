package com.repnexa.modules.assignments.controller;

import com.repnexa.modules.assignments.service.DoctorRouteAssignmentsService;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/assignments/doctor-routes")
public class DoctorRouteAssignmentsController {

    private final DoctorRouteAssignmentsService svc;

    public DoctorRouteAssignmentsController(DoctorRouteAssignmentsService svc) {
        this.svc = svc;
    }

    @PostMapping
    public void add(@AuthenticationPrincipal RepnexaUserDetails actor,
                    @RequestBody DoctorRouteAssignmentsService.CreateDoctorRouteRequest req) {
        svc.add(actor, req);
    }

    @DeleteMapping
    public void remove(@AuthenticationPrincipal RepnexaUserDetails actor,
                       @RequestParam long doctorId,
                       @RequestParam long routeId) {
        svc.remove(actor, doctorId, routeId);
    }
}
