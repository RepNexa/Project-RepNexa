package com.repnexa.modules.rep.chemist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import com.repnexa.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ChemistAndMileageIntegrationTest {

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
    void chemist_not_in_route_rejected_400() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"TC\",\"name\":\"Territory C\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long route1 = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RC1\",\"name\":\"Route 1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long route2 = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RC2\",\"name\":\"Route 2\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + route1 + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        // chemist on route2 (MVP single-route)
        long chemistId = om.readTree(mvc.perform(post("/api/v1/admin/chemists")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"routeId\":" + route2 + ",\"name\":\"Chemist X\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long p1 = om.readTree(mvc.perform(post("/api/v1/admin/products")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"P1\",\"name\":\"Prod 1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
          {
            "repRouteAssignmentId": %d,
            "visitDate": "2026-01-09",
            "visits": [
              {
                "chemistId": %d,
                "stockFlags": [
                  {"productId": %d, "status": "OOS"}
                ]
              }
            ]
          }
        """.formatted(rraId, chemistId, p1);

        mvc.perform(post("/api/v1/rep/chemist-submissions")
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
    void duplicate_stock_flag_in_same_visit_returns_409() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"TD\",\"name\":\"Territory D\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RD\",\"name\":\"Route D\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + routeId + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long chemistId = om.readTree(mvc.perform(post("/api/v1/admin/chemists")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"routeId\":" + routeId + ",\"name\":\"Chemist D\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long p1 = om.readTree(mvc.perform(post("/api/v1/admin/products")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"PD1\",\"name\":\"Prod D1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
          {
            "repRouteAssignmentId": %d,
            "visitDate": "2026-01-09",
            "visits": [
              {
                "chemistId": %d,
                "stockFlags": [
                  {"productId": %d, "status": "OOS"},
                  {"productId": %d, "status": "LOW"}
                ]
              }
            ]
          }
        """.formatted(rraId, chemistId, p1, p1);

        mvc.perform(post("/api/v1/rep/chemist-submissions")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_FLAG_DUPLICATE"));
    }

    @Test
    void duplicate_mileage_same_route_date_returns_409() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        long territoryId = om.readTree(mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"TM\",\"name\":\"Territory M\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long routeId = om.readTree(mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"RM\",\"name\":\"Route M\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        long rraId = om.readTree(mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session()).cookie(cm.csrf().cookie()).header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + routeId + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        String body = """
          { "repRouteAssignmentId": %d, "entryDate": "2026-01-09", "km": 12.5 }
        """.formatted(rraId);

        mvc.perform(post("/api/v1/rep/mileage-entries")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber());

        mvc.perform(post("/api/v1/rep/mileage-entries")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie())
                        .header("X-CSRF-Token", mr.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MILEAGE_DUPLICATE"));
    }
}
