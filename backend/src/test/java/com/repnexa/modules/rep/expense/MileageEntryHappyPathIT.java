package com.repnexa.modules.rep.expense;

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
class MileageEntryHappyPathIT {

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
    void valid_mileage_entry_can_be_created_and_listed() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();

        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TM%s","name":"Territory Mileage %s","ownerUsername":"fm@repnexa.local"}
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"territoryId":%d,"code":"RM%s","name":"Route Mileage %s"}
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

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
                {"repRouteAssignmentId": %d, "entryDate": "2026-01-09", "km": 18.75}
                """.formatted(rraId);

        long entryId = om.readTree(mvc.perform(post("/api/v1/rep/mileage-entries")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        JsonNode rows = om.readTree(mvc.perform(get("/api/v1/rep/mileage-entries")
                        .param("limit", "10")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        boolean found = false;
        for (JsonNode row : rows) {
            if (row.get("id").asLong() == entryId) {
                found = true;
                assertEquals(routeId, row.get("routeId").asLong());
                assertEquals("2026-01-09", row.get("entryDate").asText());
                assertEquals(18.75d, row.get("km").asDouble(), 0.0001);
            }
        }
        assertTrue(found, "Created mileage entry should appear in list endpoint");
    }
}
