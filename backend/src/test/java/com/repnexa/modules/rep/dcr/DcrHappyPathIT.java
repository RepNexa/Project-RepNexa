package com.repnexa.modules.rep.dcr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class DcrHappyPathIT {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

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
    void valid_dcr_submission_can_be_created_listed_and_read_back() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();

        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"T%s","name":"Territory %s","ownerUsername":"fm@repnexa.local"}
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"territoryId":%d,"code":"R%s","name":"Route %s"}
                                """.formatted(territoryId, suffix, suffix)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"repUsername":"mr@repnexa.local","routeId":%d,"startDate":"2026-01-09"}
                                """.formatted(routeId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        long doctorId = om.readTree(mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Doctor %s","specialty":"Cardiology","grade":"A","status":"ACTIVE"}
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/assignments/doctor-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"doctorId":%d,"routeId":%d}
                                """.formatted(doctorId, routeId)))
                .andExpect(status().isOk());

        long productId = om.readTree(mvc.perform(post("/api/v1/admin/products")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"P%s","name":"Product %s"}
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
                {
                  "repRouteAssignmentId": %d,
                  "callDate": "2026-01-09",
                  "doctorCalls": [
                    {
                      "doctorId": %d,
                      "callType": "IN_PERSON",
                      "productIds": [%d],
                      "remark": "Checked stock and shared samples"
                    }
                  ],
                  "missedDoctors": []
                }
                """.formatted(rraId, doctorId, productId);

        long submissionId = om.readTree(mvc.perform(post("/api/v1/rep/dcr-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        JsonNode listJson = om.readTree(mvc.perform(get("/api/v1/rep/dcr-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        boolean foundInList = false;
        for (JsonNode row : listJson) {
            if (row.get("id").asLong() == submissionId) {
                foundInList = true;
                assertEquals(routeId, row.get("routeId").asLong());
                assertEquals(1, row.get("doctorCallCount").asInt());
                assertEquals(0, row.get("missedCount").asInt());
            }
        }
        assertTrue(foundInList, "Created DCR submission should appear in list endpoint");

        JsonNode details = om.readTree(mvc.perform(get("/api/v1/rep/dcr-submissions/{id}", submissionId)
                        .session(mr.session())
                        .cookie(mr.csrf().cookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        assertEquals(submissionId, details.get("id").asLong());
        assertEquals(routeId, details.get("routeId").asLong());
        assertEquals("2026-01-09", details.get("callDate").asText());
        assertEquals(1, details.get("doctorCalls").size());
        assertEquals(0, details.get("missedDoctors").size());
        assertEquals(doctorId, details.get("doctorCalls").get(0).get("doctorId").asLong());
        assertEquals("IN_PERSON", details.get("doctorCalls").get(0).get("callType").asText());
        assertEquals("Checked stock and shared samples", details.get("doctorCalls").get(0).get("remark").asText());
        assertEquals(1, details.get("doctorCalls").get(0).get("products").size());
        assertEquals(productId, details.get("doctorCalls").get(0).get("products").get(0).get("id").asLong());
    }
}
