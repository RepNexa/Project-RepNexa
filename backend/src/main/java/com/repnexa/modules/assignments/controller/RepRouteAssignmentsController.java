package com.repnexa.modules.assignments.controller;

import com.repnexa.modules.assignments.dto.RepRouteAssignmentDtos;
import com.repnexa.modules.assignments.service.AssignmentsService;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assignments/rep-routes")
public class RepRouteAssignmentsController {

    private final AssignmentsService svc;

    public RepRouteAssignmentsController(AssignmentsService svc) {
        this.svc = svc;
    }

    // ✅ NEW: list all assignments (scoped: CM = all, FM = owned territories)
    @GetMapping
    public List<RepRouteAssignmentDtos.RepRouteAssignmentResponse> listAll(
            @AuthenticationPrincipal RepnexaUserDetails actor) {
        return svc.listAll(actor);
    }

    @PostMapping
    public RepRouteAssignmentDtos.RepRouteAssignmentResponse create(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestBody RepRouteAssignmentDtos.CreateRepRouteAssignmentRequest req) {
        return svc.create(actor, req);
    }

    @PatchMapping("/{id}")
    public RepRouteAssignmentDtos.RepRouteAssignmentResponse patch(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @PathVariable long id,
            @RequestBody RepRouteAssignmentDtos.PatchRepRouteAssignmentRequest req) {
        return svc.patch(actor, id, req);
    }
}