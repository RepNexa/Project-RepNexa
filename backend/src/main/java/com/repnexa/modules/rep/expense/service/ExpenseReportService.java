package com.repnexa.modules.rep.expense.service;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.expense.dto.ExpenseReportDtos;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ExpenseReportService {

    public List<ExpenseReportDtos.ReportListItem> list(RepnexaUserDetails actor) {
        return List.of();
    }
}