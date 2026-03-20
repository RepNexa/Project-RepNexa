package com.repnexa.modules.rep.todo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@Import(RepTodoScopeIT.FixedClockConfig.class)
public class RepTodoScopeIT {

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
    private MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    private final List<Long> createdDoctorCallIds = new ArrayList<>();
    private final List<Long> createdSubmissionIds = new ArrayList<>();
    private Long createdAssignmentId;
    private Long createdRouteId;
    private Long createdTerritoryId;
    private Long doctorAId;
    private Long doctorBId;

    @BeforeEach
    void setupMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();
    }


    @AfterEach
    void cleanup() {
        for (Long id : createdDoctorCallIds) {
            jdbc.update("DELETE FROM doctor_calls WHERE id = ?", id);
        }
        for (Long id : createdSubmissionIds) {
           jdbc.update("DELETE FROM dcr_submissions WHERE id = ?", id);
        }
        if (createdAssignmentId != null) {
            jdbc.update("DELETE FROM rep_route_assignments WHERE id = ?", createdAssignmentId);
        }
        if (doctorAId != null) jdbc.update("DELETE FROM doctor_routes WHERE doctor_id = ? AND route_id = ?", doctorAId, createdRouteId);
        if (doctorBId != null) jdbc.update("DELETE FROM doctor_routes WHERE doctor_id = ? AND route_id = ?", doctorBId, createdRouteId);
        if (doctorAId != null) jdbc.update("DELETE FROM doctors WHERE id = ?", doctorAId);
        if (doctorBId != null) jdbc.update("DELETE FROM doctors WHERE id = ?", doctorBId);
        if (createdRouteId != null) jdbc.update("DELETE FROM routes WHERE id = ?", createdRouteId);
        if (createdTerritoryId != null) jdbc.update("DELETE FROM territories WHERE id = ?", createdTerritoryId);
    }

    private long idOfUser(String username) {
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
        assertNotNull(id, "Expected user to exist: " + username);
        return id;
    }

    private long insertTerritory(long fmId) {
        return jdbc.queryForObject("""
            INSERT INTO territories (code, name, owner_user_id, deleted_at)
            VALUES ('TERR_TEST_01', 'Test Territory', ?, NULL)
            RETURNING id
        """, Long.class, fmId);
    }

    private long insertRoute(long territoryId) {
        return jdbc.queryForObject("""
            INSERT INTO routes (territory_id, code, name, deleted_at)
            VALUES (?, 'ROUTE_TEST_01', 'Test Route', NULL)
            RETURNING id
        """, Long.class, territoryId);
    }

    private long insertDoctor(String name) {
        return jdbc.queryForObject("""
            INSERT INTO doctors (name, specialty, deleted_at)
            VALUES (?, NULL, NULL)
            RETURNING id
        """, Long.class, name);
    }

    private void mapDoctorToRoute(long doctorId, long routeId) {
        jdbc.update("INSERT INTO doctor_routes (doctor_id, route_id) VALUES (?, ?)", doctorId, routeId);
    }

    private long insertAssignment(long mrId, long cmId, long routeId) {
        return jdbc.queryForObject("""
            INSERT INTO rep_route_assignments (rep_user_id, route_id, assigned_by_user_id, start_date, end_date, enabled)
            VALUES (?, ?, ?, DATE '2000-01-01', NULL, TRUE)
            RETURNING id
        """, Long.class, mrId, routeId, cmId);
    }

    private long insertSubmission(long mrId, long assignmentId, LocalDate callDate) {
        long id = jdbc.queryForObject("""
            INSERT INTO dcr_submissions (rep_user_id, rep_route_assignment_id, call_date, idempotency_key, submitted_at)
            VALUES (?, ?, ?, NULL, NOW())
            RETURNING id
        """, Long.class, mrId, assignmentId, callDate);
        createdSubmissionIds.add(id);
        return id;
    }

    private long insertDoctorCall(long submissionId, long mrId, long routeId, LocalDate callDate, long doctorId) {
        long id = jdbc.queryForObject("""
            INSERT INTO doctor_calls (submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
            VALUES (?, ?, ?, ?, ?, 'VISIT')
            RETURNING id
        """, Long.class, submissionId, mrId, routeId, callDate, doctorId);
        createdDoctorCallIds.add(id);
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
    void todo_computesMonthCounts_lastVisit_andAtRisk_andScopeDenial() throws Exception {
        long fmId = idOfUser("fm@repnexa.local");
        long cmId = idOfUser("cm@repnexa.local");
        long mrId = idOfUser("mr@repnexa.local");

        createdTerritoryId = insertTerritory(fmId);
        createdRouteId = insertRoute(createdTerritoryId);

        doctorAId = insertDoctor("Dr Alpha");
        doctorBId = insertDoctor("Dr Beta");
        mapDoctorToRoute(doctorAId, createdRouteId);
        mapDoctorToRoute(doctorBId, createdRouteId);

        createdAssignmentId = insertAssignment(mrId, cmId, createdRouteId);

        // Doctor A: two January visits, one inside sprint window [2026-01-11..2026-01-24]
        long sub1 = insertSubmission(mrId, createdAssignmentId, LocalDate.of(2026, 1, 5));
        insertDoctorCall(sub1, mrId, createdRouteId, LocalDate.of(2026, 1, 5), doctorAId);

        long sub2 = insertSubmission(mrId, createdAssignmentId, LocalDate.of(2026, 1, 20));
        insertDoctorCall(sub2, mrId, createdRouteId, LocalDate.of(2026, 1, 20), doctorAId);

        AuthCtx auth = loginMr();

        var todoRes = mockMvc.perform(get("/api/v1/rep/todo")
                        .param("month", "2026-01")
                        .param("routeId", String.valueOf(createdRouteId))
                        .session(auth.session()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode todo = mapper.readTree(todoRes.getResponse().getContentAsString());
        assertEquals(createdRouteId.longValue(), todo.get("routeId").asLong());
        assertEquals("2026-01", todo.get("month").asText());

        JsonNode rows = todo.get("rows");
        assertTrue(rows.isArray());

        JsonNode alpha = null;
        JsonNode beta = null;
        for (JsonNode r : rows) {
            String name = r.get("doctorName").asText();
            if ("Dr Alpha".equals(name)) alpha = r;
            if ("Dr Beta".equals(name)) beta = r;
        }
        assertNotNull(alpha);
        assertNotNull(beta);

        // Default grade mapping is C => planned 2 (from /meta/targets)
        assertEquals("C", alpha.get("grade").asText());
        assertEquals(2, alpha.get("plannedFrequency").asInt());
        assertEquals(2, alpha.get("visitsThisMonth").asInt());
        assertEquals(0, alpha.get("remaining").asInt());
        assertEquals("2026-01-20", alpha.get("lastVisitDate").asText());
        assertFalse(alpha.get("atRisk").asBoolean());
        assertEquals("2026-01-11", alpha.get("sprintWindowStart").asText());
        assertEquals("2026-01-24", alpha.get("sprintWindowEnd").asText());

        assertEquals("C", beta.get("grade").asText());
        assertEquals(2, beta.get("plannedFrequency").asInt());
        assertEquals(0, beta.get("visitsThisMonth").asInt());
        assertEquals(2, beta.get("remaining").asInt());
        assertTrue(beta.get("lastVisitDate").isNull());
        assertTrue(beta.get("atRisk").asBoolean());

        // Toggle atRisk for Beta by adding a sprint-window visit (2026-01-15)
        long sub3 = insertSubmission(mrId, createdAssignmentId, LocalDate.of(2026, 1, 15));
        insertDoctorCall(sub3, mrId, createdRouteId, LocalDate.of(2026, 1, 15), doctorBId);

        var todoRes2 = mockMvc.perform(get("/api/v1/rep/todo")
                        .param("month", "2026-01")
                        .param("routeId", String.valueOf(createdRouteId))
                        .session(auth.session()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode todo2 = mapper.readTree(todoRes2.getResponse().getContentAsString());
        JsonNode rows2 = todo2.get("rows");
        JsonNode beta2 = null;
        for (JsonNode r : rows2) {
            if ("Dr Beta".equals(r.get("doctorName").asText())) beta2 = r;
        }
        assertNotNull(beta2);
        assertFalse(beta2.get("atRisk").asBoolean());

        // Scope denial: route not assigned (use a non-existent route id)
        var denyRes = mockMvc.perform(get("/api/v1/rep/todo")
                        .param("month", "2026-01")
                        .param("routeId", "99999999")
                       .session(auth.session()))
                .andExpect(status().isForbidden())
                .andReturn();

        JsonNode deny = mapper.readTree(denyRes.getResponse().getContentAsString());
        assertEquals("SCOPE_FORBIDDEN", deny.get("code").asText());
    }
}
