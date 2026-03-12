package com.repnexa.modules.lookup.controller;

import com.repnexa.modules.admin.masterdata.domain.Doctor;
import com.repnexa.modules.admin.masterdata.repo.DoctorRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/lookup")
public class DoctorLookupController {

    private final DoctorRepository doctors;

    public DoctorLookupController(DoctorRepository doctors) {
        this.doctors = doctors;
    }

    public record DoctorOption(Long id, String name, String specialty) {}

    @GetMapping("/doctors")
    public List<DoctorOption> doctors(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "10") int limit
    ) {
        int lim = clamp(limit, 1, 50);
        String qq = trimToNull(q);

        return doctors.searchActiveByNamePrefix(qq).stream()
                .limit(lim)
                .map(d -> new DoctorOption(d.getId(), d.getName(), d.getSpecialty()))
                .toList();
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
