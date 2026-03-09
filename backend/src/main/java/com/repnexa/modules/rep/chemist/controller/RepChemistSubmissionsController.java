package com.repnexa.modules.rep.chemist.controller;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.chemist.dto.ChemistSubmissionDtos;
import com.repnexa.modules.rep.chemist.service.ChemistSubmissionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.repnexa.modules.rep.chemist.dto.ChemistSubmissionListDtos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rep/chemist-submissions")
public class RepChemistSubmissionsController {

    private final ChemistSubmissionService svc;

    public RepChemistSubmissionsController(ChemistSubmissionService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<ChemistSubmissionListDtos.ChemistSubmissionRow> list(@RequestParam(defaultValue = "50") int limit) {
        return svc.listMySubmissions(limit);
    }

    @PostMapping
    public ChemistSubmissionDtos.CreatedResponse create(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestBody ChemistSubmissionDtos.CreateChemistSubmissionRequest req,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        return svc.create(actor, req, idempotencyKey);
    }
}
