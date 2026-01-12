package com.repnexa.modules.rep.expense.controller;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.expense.dto.MileageDtos;
import com.repnexa.modules.rep.expense.service.MileageEntryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rep/mileage-entries")
public class RepMileageEntriesController {

    private final MileageEntryService svc;

    public RepMileageEntriesController(MileageEntryService svc) {
        this.svc = svc;
    }

    @PostMapping
    public MileageDtos.CreatedResponse create(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestBody MileageDtos.CreateMileageEntryRequest req
    ) {
        return svc.create(actor, req);
    }
}
