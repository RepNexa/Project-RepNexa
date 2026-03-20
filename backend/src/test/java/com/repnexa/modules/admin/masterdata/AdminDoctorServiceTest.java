package com.repnexa.modules.admin.masterdata;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.masterdata.domain.Doctor;
import com.repnexa.modules.admin.masterdata.dto.DoctorDtos;
import com.repnexa.modules.admin.masterdata.repo.DoctorRepository;
import com.repnexa.modules.admin.masterdata.service.AdminDoctorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDoctorServiceTest {

    @Mock DoctorRepository doctors;
    @InjectMocks AdminDoctorService service;

    @Test
    void create_trims_name_normalizes_grade_and_defaults_status() {
        when(doctors.save(any(Doctor.class))).thenAnswer(invocation -> {
            Doctor d = invocation.getArgument(0, Doctor.class);
            ReflectionTestUtils.setField(d, "id", 101L);
            return d;
        });

        DoctorDtos.DoctorResponse res = service.create(
                new DoctorDtos.CreateDoctorRequest("  Alice  ", "  Cardiology  ", " b ", null)
        );

        ArgumentCaptor<Doctor> captor = ArgumentCaptor.forClass(Doctor.class);
        verify(doctors).save(captor.capture());
        Doctor saved = captor.getValue();

        assertEquals("Alice", saved.getName());
        assertEquals("Cardiology", saved.getSpecialty());
        assertEquals("B", saved.getGrade());
        assertEquals("ACTIVE", saved.getStatus());

        assertEquals(101L, res.id());
        assertEquals("Alice", res.name());
        assertEquals("Cardiology", res.specialty());
        assertEquals("B", res.grade());
        assertEquals("ACTIVE", res.status());
        assertFalse(res.deleted());
        assertEquals(List.of(), res.locations());
    }

    @Test
    void create_invalid_grade_throws_validation_error() {
        ApiException ex = assertThrows(ApiException.class, () ->
                service.create(new DoctorDtos.CreateDoctorRequest("Alice", null, "Z", "ACTIVE"))
        );

        assertEquals(400, ex.status());
        assertEquals("VALIDATION_ERROR", ex.code());
    }

    @Test
    void patch_deleted_true_marks_doctor_deleted_in_response() {
        Doctor existing = new Doctor();
        ReflectionTestUtils.setField(existing, "id", 77L);
        existing.setName("Doctor X");
        existing.setStatus("ACTIVE");

        when(doctors.findById(77L)).thenReturn(Optional.of(existing));
        when(doctors.save(any(Doctor.class))).thenAnswer(invocation -> invocation.getArgument(0, Doctor.class));
        when(doctors.findTerritoryNamesForDoctor(77L)).thenReturn(List.of());
        when(doctors.findPrimaryRepUsernameForDoctor(77L)).thenReturn(null);
        when(doctors.findSecondaryRepUsernameForDoctor(77L)).thenReturn(null);

        DoctorDtos.DoctorResponse res = service.patch(
                77L,
                new DoctorDtos.PatchDoctorRequest(null, null, null, null, true)
        );

        assertTrue(res.deleted());
        assertNotNull(existing.getDeletedAt());
    }

    @Test
    void patch_missing_doctor_throws_doctor_not_found() {
        when(doctors.findById(999L)).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(999L, new DoctorDtos.PatchDoctorRequest("Alice", null, null, null, null))
        );

        assertEquals(404, ex.status());
        assertEquals("DOCTOR_NOT_FOUND", ex.code());
        verify(doctors, never()).save(any(Doctor.class));
    }

    @Test
    void patch_rejects_already_deleted_doctor() {
        Doctor existing = new Doctor();
        ReflectionTestUtils.setField(existing, "id", 78L);
        ReflectionTestUtils.setField(existing, "deletedAt", java.time.OffsetDateTime.now());

        when(doctors.findById(78L)).thenReturn(Optional.of(existing));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(78L, new DoctorDtos.PatchDoctorRequest("New Name", null, null, null, null))
        );

        assertEquals(409, ex.status());
        assertEquals("DOCTOR_DELETED", ex.code());
        verify(doctors, never()).save(any(Doctor.class));
    }
}
