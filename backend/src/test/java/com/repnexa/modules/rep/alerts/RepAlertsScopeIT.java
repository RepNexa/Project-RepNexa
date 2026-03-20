package com.repnexa.modules.rep.alerts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@Import(RepAlertsScopeIT.FixedClockConfig.class)
public class RepAlertsScopeIT {

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        public Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-01-24T00:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired WebApplicationContext wac;
    @Autowired @Qualifier("springSecurityFilterChain") Filter springSecurityFilterChain;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    private MockMvc mockMvc;

    private final List<Long> doctorIds = new ArrayList<>();
    private final List<Long> chemistIds = new ArrayList<>();
    private final List<Long> productIds = new ArrayList<>();
    private final List<Long> routeIds = new ArrayList<>();
    private final List<Long> territoryIds = new ArrayList<>();
    private final List<Long> assignmentIds = new ArrayList<>();

    @BeforeEach
    void setupMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    @AfterEach
    void cleanup() {
        for (Long id : assignmentIds) {
            jdbc.update("DELETE FROM rep_route_assignments WHERE id = ?", id);
        }
        for (Long id : chemistIds) {
            jdbc.update("DELETE FROM chemists WHERE id = ?", id);
        }
        for (Long id : doctorIds) {
            jdbc.update("DELETE FROM doctor_routes WHERE doctor_id = ?", id);
            jdbc.update("DELETE FROM doctors WHERE id = ?", id);
        }
        for (Long id : productIds) {
            jdbc.update("DELETE FROM products WHERE id = ?", id);
        }
        for (Long id : routeIds) {
            jdbc.update("DELETE FROM routes WHERE id = ?", id);
        }
        for (Long id : territoryIds) {
            jdbc.update("DELETE FROM territories WHERE id = ?", id);
        }
    }

    private long idOfUser(String username) {
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
        assertNotNull(id, "Expected user to exist: " + username);
        return id;
    }

    private long insertTerritory(String code, String name, long fmId) {
        long id = jdbc.queryForObject("""
            INSERT INTO territories (code, name, owner_user_id, deleted_at)
            VALUES (?, ?, ?, NULL)
            RETURNING id
        """, Long.class, code, name, fmId);
        territoryIds.add(id);
        return id;
    }

    private long insertRoute(long territoryId, String code, String name) {
        long id = jdbc.queryForObject("""
            INSERT INTO routes (territory_id, code, name, deleted_at)
            VALUES (?, ?, ?, NULL)
            RETURNING id
        """, Long.class, territoryId, code, name);
        routeIds.add(id);
        return id;
    }

    private long insertAssignment(long mrId, long cmId, long routeId) {
        long id = jdbc.queryForObject("""
            INSERT INTO rep_route_assignments (rep_user_id, route_id, assigned_by_user_id, start_date, end_date, enabled)
            VALUES (?, ?, ?, DATE '2000-01-01', NULL, TRUE)
            RETURNING id
        """, Long.class, mrId, routeId, cmId);
        assignmentIds.add(id);
        return id;
    }

    private long insertDoctor(long routeId,
                              String name,
                              String grade,
                              String status,
                              String createdAt,
                              String updatedAt,
                              String deletedAt) {
        long id = jdbc.queryForObject("""
            INSERT INTO doctors (name, specialty, grade, status, deleted_at, created_at, updated_at)
            VALUES (?, NULL, ?, ?, CAST(? AS timestamptz), CAST(? AS timestamptz), CAST(? AS timestamptz))
            RETURNING id
        """, Long.class, name, grade, status, deletedAt, createdAt, updatedAt);
        doctorIds.add(id);
        jdbc.update("INSERT INTO doctor_routes (doctor_id, route_id) VALUES (?, ?)", id, routeId);
        return id;
    }

    private long insertChemist(long routeId,
                               String name,
                               String createdAt,
                               String updatedAt,
                               String deletedAt) {
        long id = jdbc.queryForObject("""
            INSERT INTO chemists (route_id, name, deleted_at, created_at, updated_at)
            VALUES (?, ?, CAST(? AS timestamptz), CAST(? AS timestamptz), CAST(? AS timestamptz))
            RETURNING id
        """, Long.class, routeId, name, deletedAt, createdAt, updatedAt);
        chemistIds.add(id);
        return id;
    }

    private long insertProduct(String code,
                               String name,
                               String createdAt,
                               String updatedAt,
                               String deletedAt) {
        long id = jdbc.queryForObject("""
            INSERT INTO products (code, name, deleted_at, created_at, updated_at)
            VALUES (?, ?, CAST(? AS timestamptz), CAST(? AS timestamptz), CAST(? AS timestamptz))
            RETURNING id
        """, Long.class, code, name, deletedAt, createdAt, updatedAt);
        productIds.add(id);
        return id;
    }

    private record AuthCtx(MockHttpSession session, String csrfToken, Cookie xsrfCookie) {}

    private AuthCtx loginMr() throws Exception {
        MockHttpSession session = new MockHttpSession();

        var csrfRes = mockMvc.perform(get("/api/v1/auth/csrf")
                        .session(session))
                .andExpect(status().isOk())
                .andReturn();

        String csrfBody = csrfRes.getResponse().getContentAsString();
        JsonNode csrfJson = mapper.readTree(csrfBody);
        String token = csrfJson.get("token").asText();
        Cookie xsrf = csrfRes.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(xsrf, "Expected XSRF-TOKEN cookie");

        mockMvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(xsrf)
                        .header("X-CSRF-Token", token)
                        .content("{\"username\":\"mr@repnexa.local\",\"password\":\"MR@1234\"}"))
                .andExpect(status().isOk());

        return new AuthCtx(session, token, xsrf);
    }

    @Test
    void masterDataAlerts_returnsScopedRecentItems_inDescendingRecency() throws Exception {
        long fmId = idOfUser("fm@repnexa.local");
        long cmId = idOfUser("cm@repnexa.local");
        long mrId = idOfUser("mr@repnexa.local");

        long territoryId = insertTerritory("TERR_ALERTS_01", "Alerts Territory", fmId);
        long routeId = insertRoute(territoryId, "ROUTE_ALERTS_01", "Alerts Route");
        insertAssignment(mrId, cmId, routeId);

        insertDoctor(
                routeId,
                "Dr Added",
                "A",
                "ACTIVE",
                "2026-01-05T09:00:00Z",
                "2026-01-05T09:00:00Z",
                null
        );

        insertChemist(
                routeId,
                "Chemist Updated",
                "2026-01-02T09:00:00Z",
                "2026-01-15T12:00:00Z",
                null
        );

        insertProduct(
                "PDEL01",
                "Deleted Product",
                "2026-01-03T09:00:00Z",
                "2026-01-20T15:00:00Z",
                "2026-01-20T15:00:00Z"
        );

        AuthCtx auth = loginMr();

        var res = mockMvc.perform(get("/api/v1/rep/alerts/master-data")
                        .param("routeId", String.valueOf(routeId))
                        .param("limit", "5")
                        .session(auth.session()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        assertEquals(routeId, json.get("routeId").asLong());
        JsonNode items = json.get("items");
        assertTrue(items.isArray());
        assertEquals(3, items.size());

        assertEquals("PRODUCT", items.get(0).get("entityType").asText());
        assertEquals("DELETED", items.get(0).get("changeKind").asText());
        assertEquals("PDEL01 — Deleted Product", items.get(0).get("title").asText());

        assertEquals("CHEMIST", items.get(1).get("entityType").asText());
        assertEquals("UPDATED", items.get(1).get("changeKind").asText());
        assertEquals("Chemist Updated", items.get(1).get("title").asText());

        assertEquals("DOCTOR", items.get(2).get("entityType").asText());
        assertEquals("ADDED", items.get(2).get("changeKind").asText());
        assertEquals("Dr Added", items.get(2).get("title").asText());
    }

    @Test
    void masterDataAlerts_deniesAccess_forUnassignedRoute() throws Exception {
        long fmId = idOfUser("fm@repnexa.local");
        long cmId = idOfUser("cm@repnexa.local");
        long mrId = idOfUser("mr@repnexa.local");

        long territoryId = insertTerritory("TERR_ALERTS_02", "Denied Territory", fmId);
        long assignedRouteId = insertRoute(territoryId, "ROUTE_ALERTS_02A", "Assigned Route");
        long otherRouteId = insertRoute(territoryId, "ROUTE_ALERTS_02B", "Other Route");
        insertAssignment(mrId, cmId, assignedRouteId);

        AuthCtx auth = loginMr();

        mockMvc.perform(get("/api/v1/rep/alerts/master-data")
                        .param("routeId", String.valueOf(otherRouteId))
                        .session(auth.session()))
                .andExpect(status().isForbidden());
    }

    @Test
    void masterDataAlerts_returnsEmptyItems_whenNothingRecentExists() throws Exception {
        long fmId = idOfUser("fm@repnexa.local");
        long cmId = idOfUser("cm@repnexa.local");
        long mrId = idOfUser("mr@repnexa.local");

        long territoryId = insertTerritory("TERR_ALERTS_03", "Empty Territory", fmId);
        long routeId = insertRoute(territoryId, "ROUTE_ALERTS_03", "Empty Route");
        insertAssignment(mrId, cmId, routeId);

        insertDoctor(
                routeId,
                "Dr Old",
                "C",
                "ACTIVE",
                "2025-11-01T09:00:00Z",
                "2025-11-15T09:00:00Z",
                null
        );

        AuthCtx auth = loginMr();

        var res = mockMvc.perform(get("/api/v1/rep/alerts/master-data")
                        .param("routeId", String.valueOf(routeId))
                        .session(auth.session()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        assertEquals(routeId, json.get("routeId").asLong());
        assertTrue(json.get("items").isArray());
        assertEquals(0, json.get("items").size());
    }

    @Test
    @WithAnonymousUser
    void masterDataAlerts_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/rep/alerts/master-data")
                        .param("routeId", "1"))
                .andExpect(status().isUnauthorized());
    }
}