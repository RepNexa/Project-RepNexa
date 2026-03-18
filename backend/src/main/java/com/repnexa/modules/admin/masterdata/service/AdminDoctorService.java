package com.repnexa.modules.admin.masterdata.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.masterdata.domain.Doctor;
import com.repnexa.modules.admin.masterdata.dto.DoctorDtos;
import com.repnexa.modules.admin.masterdata.repo.DoctorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctors;

    public AdminDoctorService(DoctorRepository doctors) {
        this.doctors = doctors;
    }

    @Transactional(readOnly = true)
    public List<DoctorDtos.DoctorResponse> list(String q) {
        return doctors.searchActiveByNamePrefix(trimToNull(q)).stream()
                .map(d -> new DoctorDtos.DoctorResponse(
                        d.getId(),
                        d.getName(),
                        d.getSpecialty(),
                        d.getGrade(),
                        d.getStatus(),
                        d.getDeletedAt() != null,
                        doctors.findTerritoryNamesForDoctor(d.getId()),
                        doctors.findPrimaryRepUsernameForDoctor(d.getId()),
                        doctors.findSecondaryRepUsernameForDoctor(d.getId()), // ✅ NEW: secondaryRep
                        d.getUpdatedAt() == null ? null : d.getUpdatedAt().toString() // ✅ lastUpdated
                ))
                .toList();
    }

    @Transactional
    public DoctorDtos.DoctorResponse create(DoctorDtos.CreateDoctorRequest req) {
        if (req == null || isBlank(req.name())) {
            throw ApiException.badRequest("VALIDATION_ERROR", "name is required");
        }

        Doctor d = new Doctor();
        d.setName(req.name().trim());
        d.setSpecialty(trimToNull(req.specialty()));
        d.setGrade(normalizeGrade(req.grade()));
        d.setStatus(normalizeStatus(req.status()));

        Doctor saved = doctors.save(d);

        return new DoctorDtos.DoctorResponse(
                saved.getId(),
                saved.getName(),
                saved.getSpecialty(),
                saved.getGrade(),
                saved.getStatus(),
                false,
                List.of(),
                null,
                null, // ✅ NEW: secondaryRep (none on create)
                saved.getUpdatedAt() == null ? null : saved.getUpdatedAt().toString());
    }

    @Transactional
    public DoctorDtos.DoctorResponse patch(long id, DoctorDtos.PatchDoctorRequest req) {
        Doctor d = doctors.findById(id)
                .orElseThrow(() -> ApiException.notFound("DOCTOR_NOT_FOUND", "Doctor not found"));

        if (d.getDeletedAt() != null) {
            throw ApiException.conflict("DOCTOR_DELETED", "Doctor is deleted");
        }

        if (req != null) {
            if (!isBlank(req.name()))
                d.setName(req.name().trim());
            if (req.specialty() != null)
                d.setSpecialty(trimToNull(req.specialty()));
            if (req.grade() != null)
                d.setGrade(normalizeGrade(req.grade()));
            if (req.status() != null)
                d.setStatus(normalizeStatus(req.status()));
            if (Boolean.TRUE.equals(req.deleted()))
                d.softDeleteNow();
        }

        Doctor saved = doctors.save(d);

        return new DoctorDtos.DoctorResponse(
                saved.getId(),
                saved.getName(),
                saved.getSpecialty(),
                saved.getGrade(),
                saved.getStatus(),
                saved.getDeletedAt() != null,
                doctors.findTerritoryNamesForDoctor(saved.getId()),
                doctors.findPrimaryRepUsernameForDoctor(saved.getId()),
                doctors.findSecondaryRepUsernameForDoctor(saved.getId()), // ✅ NEW
                saved.getUpdatedAt() == null ? null : saved.getUpdatedAt().toString());
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String trimToNull(String s) {
        if (s == null)
            return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normalizeGrade(String grade) {
        String g = trimToNull(grade);
        if (g == null)
            return null;

        String u = g.toUpperCase();
        if (!u.equals("A") && !u.equals("B") && !u.equals("C")) {
            throw ApiException.badRequest("VALIDATION_ERROR", "grade must be A, B, C or null");
        }
        return u;
    }

    private static String normalizeStatus(String status) {
        String s = trimToNull(status);
        if (s == null)
            return "ACTIVE";

        String u = s.toUpperCase();
        if (!u.equals("ACTIVE") && !u.equals("RETIRED")) {
            throw ApiException.badRequest("VALIDATION_ERROR", "status must be ACTIVE or RETIRED");
        }
        return u;
    }
}