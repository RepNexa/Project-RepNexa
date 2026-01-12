package com.repnexa.modules.rep.dcr.controller;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.dcr.dto.DcrSubmissionDtos;
import com.repnexa.modules.rep.dcr.service.DcrSubmissionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rep/dcr-submissions")
public class RepDcrSubmissionsController {

    private final DcrSubmissionService svc;

    public RepDcrSubmissionsController(DcrSubmissionService svc) {
        this.svc = svc;
    }

    @PostMapping
    public DcrSubmissionDtos.CreatedResponse create(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestBody DcrSubmissionDtos.CreateDcrSubmissionRequest req,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        return svc.create(actor, req, idempotencyKey);
    }

    @GetMapping
    public List<DcrSubmissionDtos.SubmissionListItem> list(@AuthenticationPrincipal RepnexaUserDetails actor) {
        return svc.list(actor);
    }

    @GetMapping("/{id}")
    public DcrSubmissionDtos.SubmissionDetails get(@AuthenticationPrincipal RepnexaUserDetails actor, @PathVariable long id) {
        return svc.getById(actor, id);
    }
}
