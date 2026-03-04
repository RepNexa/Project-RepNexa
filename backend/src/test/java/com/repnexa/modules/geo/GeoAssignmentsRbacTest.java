package com.repnexa.modules.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.servlet.http.Cookie;

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
class GeoAssignmentsRbacTest {

        @Autowired
        MockMvc mvc;
        @Autowired
        ObjectMapper om;

        record Csrf(Cookie cookie, String token) {
        }

        record SessionCtx(MockHttpSession session, Csrf csrf) {
        }

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
        void fm_cannot_access_admin_and_can_assign_only_within_scope_and_mr_context_is_scoped() throws Exception {
                // CM creates territory+route owned by FM
                SessionCtx cm = login("cm@repnexa.local", "CM@1234");

                var tRes = mvc.perform(post("/api/v1/admin/territories")
                                .session(cm.session())
                                .cookie(cm.csrf().cookie())
                                .header("X-CSRF-Token", cm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"T-NORTH\",\"name\":\"North\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.code").value("T-NORTH"))
                                .andReturn();

                long territoryId = om.readTree(tRes.getResponse().getContentAsString()).get("id").asLong();

                var rRes = mvc.perform(post("/api/v1/admin/routes")
                                .session(cm.session())
                                .cookie(cm.csrf().cookie())
                                .header("X-CSRF-Token", cm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"territoryId\":" + territoryId
                                                + ",\"code\":\"R-001\",\"name\":\"Route 1\"}"))
                                .andExpect(status().isOk())
                                .andReturn();

                long routeId = om.readTree(rRes.getResponse().getContentAsString()).get("id").asLong();

                // CM creates another route NOT owned by FM (territory owner null)
                var t2Res = mvc.perform(post("/api/v1/admin/territories")
                                .session(cm.session())
                                .cookie(cm.csrf().cookie())
                                .header("X-CSRF-Token", cm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"T-SOUTH\",\"name\":\"South\",\"ownerUsername\":null}"))
                                .andExpect(status().isOk())
                                .andReturn();
                long territory2Id = om.readTree(t2Res.getResponse().getContentAsString()).get("id").asLong();

                var r2Res = mvc.perform(post("/api/v1/admin/routes")
                                .session(cm.session())
                                .cookie(cm.csrf().cookie())
                                .header("X-CSRF-Token", cm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"territoryId\":" + territory2Id
                                                + ",\"code\":\"R-002\",\"name\":\"Route 2\"}"))
                                .andExpect(status().isOk())
                                .andReturn();
                long route2Id = om.readTree(r2Res.getResponse().getContentAsString()).get("id").asLong();

                // FM cannot access admin endpoints
                SessionCtx fm = login("fm@repnexa.local", "FM@1234");
                mvc.perform(get("/api/v1/admin/territories").session(fm.session()))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.code").value("RBAC_FORBIDDEN"));

                // FM can assign within owned scope
                var aRes = mvc.perform(post("/api/v1/assignments/rep-routes")
                                .session(fm.session())
                                .cookie(fm.csrf().cookie())
                                .header("X-CSRF-Token", fm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + routeId
                                                + ",\"startDate\":\"2026-01-09\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.routeId").value((int) routeId))
                                .andReturn();

                long assignmentId = om.readTree(aRes.getResponse().getContentAsString()).get("id").asLong();

                // FM cannot assign outside owned scope
                mvc.perform(post("/api/v1/assignments/rep-routes")
                                .session(fm.session())
                                .cookie(fm.csrf().cookie())
                                .header("X-CSRF-Token", fm.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + route2Id
                                                + ",\"startDate\":\"2026-01-09\"}"))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.code").value("SCOPE_FORBIDDEN"));

                // MR sees own assignments in /rep/context
                SessionCtx mr = login("mr@repnexa.local", "MR@1234");
                // Do not assume ordering of routes[]. Assert the created assignment appears
                // somewhere.
                String match = "$.routes[?(@.routeId == " + routeId + " && @.repRouteAssignmentId == " + assignmentId
                                + ")]";
                mvc.perform(get("/api/v1/rep/context").session(mr.session()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.routes", hasSize(greaterThanOrEqualTo(1))))
                                .andExpect(jsonPath(match, hasSize(1)));
        }
}
