package com.repnexa.modules.analytics.company;

import com.repnexa.modules.analytics.company.service.CompanyOverviewService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CoverageMathTest {

    @Test
    void safeRatio_returns_null_on_zero_denominator() {
        assertNull(CompanyOverviewService.safeRatio(10, 0));
        assertNull(CompanyOverviewService.safeRatio(0, 0));
    }

    @Test
    void safeRatio_computes_fraction() {
        assertEquals(0.5, CompanyOverviewService.safeRatio(5, 10), 1e-9);
        assertEquals(0.0, CompanyOverviewService.safeRatio(0, 10), 1e-9);
        assertEquals(1.0, CompanyOverviewService.safeRatio(10, 10), 1e-9);
    }

    @Test
    void safeDelta_null_propagation_and_value() {
        assertNull(CompanyOverviewService.safeDelta(null, 0.2));
        assertNull(CompanyOverviewService.safeDelta(0.2, null));
        assertEquals(0.1, CompanyOverviewService.safeDelta(0.6, 0.5), 1e-9);
    }
}