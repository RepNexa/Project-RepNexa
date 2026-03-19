package com.repnexa.modules.admin.masterdata;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.geo.domain.Route;
import com.repnexa.modules.admin.geo.repo.RouteRepository;
import com.repnexa.modules.admin.masterdata.domain.Chemist;
import com.repnexa.modules.admin.masterdata.dto.ChemistDtos;
import com.repnexa.modules.admin.masterdata.repo.ChemistRepository;
import com.repnexa.modules.admin.masterdata.service.AdminChemistService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminChemistServiceTest {

    @Mock ChemistRepository chemists;
    @Mock RouteRepository routes;
    @InjectMocks AdminChemistService service;

    @Test
    void create_trims_name_and_persists_route_id() {
        Route route = new Route();
        ReflectionTestUtils.setField(route, "id", 5L);

        when(routes.findById(5L)).thenReturn(Optional.of(route));
        when(chemists.save(any(Chemist.class))).thenAnswer(invocation -> {
            Chemist c = invocation.getArgument(0, Chemist.class);
            ReflectionTestUtils.setField(c, "id", 99L);
            return c;
        });

        ChemistDtos.ChemistResponse res = service.create(new ChemistDtos.CreateChemistRequest(5L, "  Chemist A  "));

        ArgumentCaptor<Chemist> captor = ArgumentCaptor.forClass(Chemist.class);
        verify(chemists).save(captor.capture());
        Chemist saved = captor.getValue();

        assertEquals(5L, saved.getRouteId());
        assertEquals("Chemist A", saved.getName());
        assertEquals(99L, res.id());
        assertEquals(5L, res.routeId());
        assertEquals("Chemist A", res.name());
        assertFalse(res.deleted());
    }

    @Test
    void create_rejects_deleted_route() {
        Route route = new Route();
        ReflectionTestUtils.setField(route, "id", 5L);
        ReflectionTestUtils.setField(route, "deletedAt", OffsetDateTime.now());

        when(routes.findById(5L)).thenReturn(Optional.of(route));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.create(new ChemistDtos.CreateChemistRequest(5L, "Chemist A"))
        );

        assertEquals(409, ex.status());
        assertEquals("ROUTE_DELETED", ex.code());
    }

    @Test
    void patch_rejects_already_deleted_chemist() {
        Chemist chemist = new Chemist();
        ReflectionTestUtils.setField(chemist, "id", 12L);
        ReflectionTestUtils.setField(chemist, "deletedAt", OffsetDateTime.now());

        when(chemists.findById(12L)).thenReturn(Optional.of(chemist));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(12L, new ChemistDtos.PatchChemistRequest(null, "New Name", null))
        );

        assertEquals(409, ex.status());
        assertEquals("CHEMIST_DELETED", ex.code());
    }
    @Test
    void create_missing_route_or_name_throws_validation_error() {
        ApiException ex1 = assertThrows(ApiException.class, () ->
                service.create(new ChemistDtos.CreateChemistRequest(null, "Chemist A"))
        );
        assertEquals(400, ex1.status());
        assertEquals("VALIDATION_ERROR", ex1.code());

        ApiException ex2 = assertThrows(ApiException.class, () ->
                service.create(new ChemistDtos.CreateChemistRequest(5L, "   "))
        );
        assertEquals(400, ex2.status());
        assertEquals("VALIDATION_ERROR", ex2.code());

        verify(routes, never()).findById(anyLong());
        verify(chemists, never()).save(any(Chemist.class));
    }

    @Test
    void patch_rejects_missing_route() {
        Chemist chemist = new Chemist();
        ReflectionTestUtils.setField(chemist, "id", 13L);
        chemist.setRouteId(5L);
        chemist.setName("Chemist A");

        when(chemists.findById(13L)).thenReturn(Optional.of(chemist));
        when(routes.findById(99L)).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(13L, new ChemistDtos.PatchChemistRequest(99L, null, null))
        );

        assertEquals(404, ex.status());
        assertEquals("ROUTE_NOT_FOUND", ex.code());
        verify(chemists, never()).save(any(Chemist.class));
    }

    @Test
    void patch_rejects_deleted_route() {
        Chemist chemist = new Chemist();
        ReflectionTestUtils.setField(chemist, "id", 14L);
        chemist.setRouteId(5L);
        chemist.setName("Chemist A");

        Route deletedRoute = new Route();
        ReflectionTestUtils.setField(deletedRoute, "id", 7L);
        ReflectionTestUtils.setField(deletedRoute, "deletedAt", OffsetDateTime.now());

        when(chemists.findById(14L)).thenReturn(Optional.of(chemist));
        when(routes.findById(7L)).thenReturn(Optional.of(deletedRoute));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(14L, new ChemistDtos.PatchChemistRequest(7L, null, null))
        );

        assertEquals(409, ex.status());
        assertEquals("ROUTE_DELETED", ex.code());
        verify(chemists, never()).save(any(Chemist.class));
    }
}
