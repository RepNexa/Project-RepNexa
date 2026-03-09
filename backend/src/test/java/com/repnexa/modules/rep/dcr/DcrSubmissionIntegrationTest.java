package com.repnexa.modules.rep.dcr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;


import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.UUID;

import com.repnexa.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class DcrSubmissionIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;

    record Csrf(Cookie cookie, String token) {}
    record SessionCtx(MockHttpSession session, Csrf csrf) {}

    private Csrf csrf() throws Exception {
        var res = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie xsrfCookie = res.getResponse().getCookie("XSRF-TOKEN");
        JsonNode json = om.readTree(res.getResponse().getContentAsString());
        return new Csrf(xsrfCookie, json.get("token").asText());
    }

    private SessionCtx login(String username, String password) throws Exception {
        Csrf c = csrf();
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(c.cookie())
                        .header("X-CSRF-Token", c.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());
        return new SessionCtx(session, c);
    }

    @Test
    void duplicate_doctor_call_returns_409_code() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        // territory + route
        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"T1\",\"name\":\"Territory 1\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"R1\",\"name\":\"Route 1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // assign MR to route
        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + routeId + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // create doctor + map to route
        long doctorId = om.readTree(mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Alice\",\"specialty\":\"Cardiology\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/assignments/doctor-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"doctorId\":" + doctorId + ",\"routeId\":" + routeId + "}"))
                .andExpect(status().isOk());

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
            {
              "repRouteAssignmentId": %d,
              "callDate": "2026-01-09",
              "doctorCalls": [
                { "doctorId": %d, "callType": "IN_PERSON", "productIds": [] }
              ],
              "missedDoctors": []
            }
        """.formatted(rraId, doctorId);

        // first submit OK
        mvc.perform(post("/api/v1/rep/dcr-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber());

        // duplicate submit (new idempotency key) -> 409 DOCTOR_CALL_DUPLICATE
        mvc.perform(post("/api/v1/rep/dcr-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCTOR_CALL_DUPLICATE"))
                .andExpect(jsonPath("$.fieldErrors", notNullValue()));
    }

    @Test
    void doctor_not_in_route_rejected_400() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"T2\",\"name\":\"Territory 2\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RX\",\"name\":\"Route X\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + routeId + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // doctor created but NOT mapped to route
        long doctorId = om.readTree(mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Unmapped\",\"specialty\":null}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
            {
              "repRouteAssignmentId": %d,
              "callDate": "2026-01-09",
              "doctorCalls": [
                { "doctorId": %d, "callType": "IN_PERSON", "productIds": [] }
              ],
              "missedDoctors": []
            }
        """.formatted(rraId, doctorId);

        mvc.perform(post("/api/v1/rep/dcr-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void mr_cannot_submit_with_someone_elses_repRouteAssignmentId() throws Exception {
        // Create another MR directly (test-only) and assign them a route; logged-in MR must not use that assignment id.
        String otherMr = "mr2+" + UUID.randomUUID() + "@repnexa.local";
        String hash = passwordEncoder.encode("MR2@1234");

        jdbc.update("""
            INSERT INTO users (username, password_hash, role, enabled, must_change_password, created_at, updated_at)
            VALUES (?, ?, 'MR', TRUE, FALSE, NOW(), NOW())
        """, otherMr, hash);

        Long mr2Id = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, otherMr);

        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"T3\",\"name\":\"Territory 3\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RZ\",\"name\":\"Route Z\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // Create rep_route_assignment for MR2 (using existing endpoint)
        long rraIdMr2 = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"" + otherMr + "\",\"routeId\":" + routeId + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // Create doctor + map to route
        long doctorId = om.readTree(mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Scoped\",\"specialty\":null}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/assignments/doctor-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"doctorId\":" + doctorId + ",\"routeId\":" + routeId + "}"))
                .andExpect(status().isOk());

        // Logged-in MR1 tries to use MR2's assignment id -> 403
        SessionCtx mr1 = login("mr@repnexa.local", "MR@1234");

        String body = """
            {
              "repRouteAssignmentId": %d,
              "callDate": "2026-01-09",
              "doctorCalls": [
                { "doctorId": %d, "callType": "IN_PERSON", "productIds": [] }
              ],
              "missedDoctors": []
            }
        """.formatted(rraIdMr2, doctorId);

        mvc.perform(post("/api/v1/rep/dcr-submissions")
                        .session(mr1.session())
                        .cookie(mr1.csrf().cookie())
                        .header("X-CSRF-Token", mr1.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SCOPE_FORBIDDEN"));
    }
}
