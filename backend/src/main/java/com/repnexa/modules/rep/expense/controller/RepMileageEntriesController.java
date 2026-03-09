package com.repnexa.modules.rep.expense.controller;

import com.repnexa.modules.rep.expense.dto.MileageListDtos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

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

    @GetMapping
    public List<MileageListDtos.MileageEntryRow> list(@RequestParam(defaultValue = "50") int limit) {
        return svc.listMyEntries(limit);
    }

    @PostMapping
    public MileageDtos.CreatedResponse create(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestBody MileageDtos.CreateMileageEntryRequest req
    ) {
        return svc.create(actor, req);
    }
}
