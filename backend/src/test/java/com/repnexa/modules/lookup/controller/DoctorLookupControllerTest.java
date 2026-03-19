package com.repnexa.modules.lookup.controller;

import com.repnexa.modules.admin.masterdata.domain.Doctor;
import com.repnexa.modules.admin.masterdata.repo.DoctorRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DoctorLookupControllerTest {

    @Mock DoctorRepository doctors;

    @Test
    void doctors_trims_query_and_clamps_limit_to_max_50() {
        Doctor a = doctor(1L, "Alice", "Cardiology");
        Doctor b = doctor(2L, "Alina", "ENT");
        when(doctors.searchActiveByNamePrefix("Ali")).thenReturn(List.of(a, b));

        DoctorLookupController controller = new DoctorLookupController(doctors);
        List<DoctorLookupController.DoctorOption> result = controller.doctors("  Ali  ", 99);

        verify(doctors).searchActiveByNamePrefix("Ali");
        assertEquals(2, result.size());
        assertEquals("Alice", result.get(0).name());
        assertEquals("Cardiology", result.get(0).specialty());
    }

    @Test
    void doctors_blank_query_becomes_null_and_limit_below_one_clamps_to_one() {
        Doctor a = doctor(1L, "Alice", "Cardiology");
        Doctor b = doctor(2L, "Bob", "ENT");
        when(doctors.searchActiveByNamePrefix(null)).thenReturn(List.of(a, b));

        DoctorLookupController controller = new DoctorLookupController(doctors);
        List<DoctorLookupController.DoctorOption> result = controller.doctors("   ", 0);

        verify(doctors).searchActiveByNamePrefix(null);
        assertEquals(1, result.size());
        assertEquals("Alice", result.get(0).name());
    }

    private static Doctor doctor(Long id, String name, String specialty) {
        Doctor d = new Doctor();
        ReflectionTestUtils.setField(d, "id", id);
        d.setName(name);
        d.setSpecialty(specialty);
        return d;
    }
}