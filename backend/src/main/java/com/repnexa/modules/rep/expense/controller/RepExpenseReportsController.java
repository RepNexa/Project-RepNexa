package com.repnexa.modules.rep.expense.controller;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.expense.dto.ExpenseReportDtos;
import com.repnexa.modules.rep.expense.service.ExpenseReportService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rep/expense-reports")
@PreAuthorize("hasRole('MR')")
public class RepExpenseReportsController {

    private final ExpenseReportService svc;

    public RepExpenseReportsController(ExpenseReportService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<ExpenseReportDtos.ReportListItem> list(
            @AuthenticationPrincipal RepnexaUserDetails actor
    ) {
        return svc.list(actor);
    }
}
