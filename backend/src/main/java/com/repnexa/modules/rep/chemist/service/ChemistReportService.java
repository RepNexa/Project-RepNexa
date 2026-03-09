package com.repnexa.modules.rep.chemist.service;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.chemist.dto.ChemistReportDtos;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChemistReportService {

    public List<ChemistReportDtos.ReportListItem> list(RepnexaUserDetails actor) {
        return List.of();
    }
}