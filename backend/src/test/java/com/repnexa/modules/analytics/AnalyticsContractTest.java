package com.repnexa.modules.analytics;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class AnalyticsContractTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    private static final String CM_U = System.getProperty("repnexa.cm.user", "cm@repnexa.local");
    private static final String CM_P = System.getProperty("repnexa.cm.pass", "CM@1234");

    private static final String FM_U = System.getProperty("repnexa.fm.user", "fm@repnexa.local");
    private static final String FM_P = System.getProperty("repnexa.fm.pass", "FM@1234");

    private static final String MR_U = System.getProperty("repnexa.mr.user", "mr@repnexa.local");
    private static final String MR_P = System.getProperty("repnexa.mr.pass", "MR@1234");

    @Test
    void analytics_endpoints_rbac_matrix() throws Exception {
        // anon: must be 401 AUTH_REQUIRED
        MvcResult anonRes = mvc.perform(post("/api/v1/analytics/company-overview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"period\":\"THIS_MONTH\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn();

        Map<?, ?> anonBody = jsonObject(anonRes);
        assertEquals("AUTH_REQUIRED", anonBody.get("code"));

        // MR: must be 403 RBAC_FORBIDDEN
        LoggedIn mr = login(MR_U, MR_P);
        MvcResult mrRes = postJsonAs(mr, "/api/v1/analytics/company-overview", "{\"period\":\"THIS_MONTH\"}")
                .andExpect(status().isForbidden())
                .andReturn();

        Map<?, ?> mrBody = jsonObject(mrRes);
        assertEquals("RBAC_FORBIDDEN", mrBody.get("code"));

        // FM: must be 200
        LoggedIn fm = login(FM_U, FM_P);
        MvcResult fmRes = postJsonAs(fm, "/api/v1/analytics/company-overview", "{\"period\":\"THIS_MONTH\"}")
                .andExpect(status().isOk())
                .andReturn();

        // CM: must be 200
        LoggedIn cm = login(CM_U, CM_P);
        MvcResult cmRes = postJsonAs(cm, "/api/v1/analytics/company-overview", "{\"period\":\"THIS_MONTH\"}")
                .andExpect(status().isOk())
                .andReturn();

        Map<?, ?> body = jsonObject(cmRes);
        assertNotNull(body.get("periodUsed"));
        assertNotNull(body.get("scope"));

        Object barsObj = body.get("coverageByGrade");
        assertTrue(barsObj instanceof List, "coverageByGrade must be a list");
        assertEquals(3, ((List<?>) barsObj).size(), "coverageByGrade must always include A/B/C bars");
    }

    @Test
    void drilldown_endpoints_exist_and_return_json() throws Exception {
        LoggedIn cm = login(CM_U, CM_P);

        MvcResult overviewRes = postJsonAs(cm, "/api/v1/analytics/company-overview", "{\"period\":\"THIS_MONTH\"}")
                .andExpect(status().isOk())
                .andReturn();

        Map<?, ?> overviewBody = jsonObject(overviewRes);
        Object scopeObj = overviewBody.get("scope");
        boolean hasEffectiveRoutes = false;
        if (scopeObj instanceof Map<?, ?> scopeMap) {
            Object routeIdsObj = scopeMap.get("effectiveRouteIds");
            hasEffectiveRoutes = routeIdsObj instanceof List && !((List<?>) routeIdsObj).isEmpty();
        }

        if (hasEffectiveRoutes) {
            MvcResult dd = postJsonAs(cm, "/api/v1/analytics/doctor-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isOk())
                    .andReturn();
            Map<?, ?> ddBody = jsonObject(dd);
            assertNotNull(ddBody.get("rows"));
            assertNotNull(ddBody.get("flags"));

            MvcResult rd = postJsonAs(cm, "/api/v1/analytics/rep-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isOk())
                    .andReturn();
            Map<?, ?> rdBody = jsonObject(rd);
            assertNotNull(rdBody.get("rows"));
            assertNotNull(rdBody.get("flags"));

            postJsonAs(cm, "/api/v1/analytics/product-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isOk());

            postJsonAs(cm, "/api/v1/analytics/chemist-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isOk());
        } else {
            MvcResult dd = postJsonAs(cm, "/api/v1/analytics/doctor-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isForbidden())
                    .andReturn();
            assertApiCode(dd, "SCOPE_FORBIDDEN");

            MvcResult rd = postJsonAs(cm, "/api/v1/analytics/rep-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isForbidden())
                    .andReturn();
            assertApiCode(rd, "SCOPE_FORBIDDEN");

            MvcResult pd = postJsonAs(cm, "/api/v1/analytics/product-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isForbidden())
                    .andReturn();
            assertApiCode(pd, "SCOPE_FORBIDDEN");

            MvcResult cd = postJsonAs(cm, "/api/v1/analytics/chemist-details", "{\"period\":\"THIS_MONTH\"}")
                    .andExpect(status().isForbidden())
                    .andReturn();
            assertApiCode(cd, "SCOPE_FORBIDDEN");
        }

        MvcResult vl = mvc.perform(get("/api/v1/analytics/doctors/999999/visit-log")
                        .session(cm.session))
                .andExpect(status().isNotFound())
                .andReturn();

        Map<?, ?> vlBody = jsonObject(vl);
        assertEquals("DOCTOR_NOT_FOUND", vlBody.get("code"));
    }

    private void assertApiCode(MvcResult res, String expectedCode) throws Exception {
        Map<?, ?> body = jsonObject(res);
        assertEquals(expectedCode, body.get("code"));
    }

    private LoggedIn login(String username, String password) throws Exception {
        MvcResult csrfRes = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode csrfJson = om.readTree(csrfRes.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();

        Cookie xsrf = csrfRes.getResponse().getCookie("XSRF-TOKEN");
        if (xsrf == null) xsrf = new Cookie("XSRF-TOKEN", token);

        MockHttpSession session = (MockHttpSession) csrfRes.getRequest().getSession();

        mvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(xsrf)
                        .header("X-CSRF-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());

        return new LoggedIn(session, xsrf, token);
    }

    private org.springframework.test.web.servlet.ResultActions postJsonAs(
            LoggedIn user, String path, String json
    ) throws Exception {
        return mvc.perform(post(path)
                .session(user.session)
                .cookie(user.xsrfCookie)
                .header("X-CSRF-Token", user.csrfToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private Map<?, ?> jsonObject(MvcResult res) throws Exception {
        return om.readValue(res.getResponse().getContentAsString(), Map.class);
    }

    private record LoggedIn(MockHttpSession session, Cookie xsrfCookie, String csrfToken) {}
}