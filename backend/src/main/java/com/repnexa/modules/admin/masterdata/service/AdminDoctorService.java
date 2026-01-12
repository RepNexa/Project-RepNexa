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
        .map(d -> new DoctorDtos.DoctorResponse(d.getId(), d.getName(), d.getSpecialty(), d.getDeletedAt() != null))
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
    Doctor saved = doctors.save(d);
    return new DoctorDtos.DoctorResponse(saved.getId(), saved.getName(), saved.getSpecialty(), false);
  }

  @Transactional
  public DoctorDtos.DoctorResponse patch(long id, DoctorDtos.PatchDoctorRequest req) {
    Doctor d = doctors.findById(id).orElseThrow(() -> ApiException.notFound("DOCTOR_NOT_FOUND", "Doctor not found"));
    if (d.getDeletedAt() != null)
      throw ApiException.conflict("DOCTOR_DELETED", "Doctor is deleted");

    if (req != null) {
      if (!isBlank(req.name()))
        d.setName(req.name().trim());
      if (req.specialty() != null)
        d.setSpecialty(trimToNull(req.specialty()));
      if (Boolean.TRUE.equals(req.deleted()))
        d.softDeleteNow();
    }
    Doctor saved = doctors.save(d);
    return new DoctorDtos.DoctorResponse(saved.getId(), saved.getName(), saved.getSpecialty(),
        saved.getDeletedAt() != null);
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
}
