package com.repnexa.modules.analytics;

import com.repnexa.testsupport.HttpSessionClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AnalyticsContractTest {

    @LocalServerPort
    int port;

    private String apiBase() {
        return "http://localhost:" + port + "/api/v1";
    }

    // Adjust these if your seed usernames/passwords differ
    private static final String CM_U = System.getProperty("repnexa.cm.user", "cm@repnexa.local");
    private static final String CM_P = System.getProperty("repnexa.cm.pass", "CM@1234");

    private static final String FM_U = System.getProperty("repnexa.fm.user", "fm@repnexa.local");
    private static final String FM_P = System.getProperty("repnexa.fm.pass", "FM@1234");

    private static final String MR_U = System.getProperty("repnexa.mr.user", "mr@repnexa.local");
    private static final String MR_P = System.getProperty("repnexa.mr.pass", "MR@1234");

    @Test
    void analytics_endpoints_rbac_matrix() throws Exception {
        String base = apiBase();

        // anon: must be 401 AUTH_REQUIRED (your CSRF ordering fix)
        HttpSessionClient anon = HttpSessionClient.anonymous(base);
        HttpResponse<String> anonRes = anon.postJsonNoCsrf(
                "/analytics/company-overview",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(401, anonRes.statusCode(), anonRes.body());
        assertEquals("AUTH_REQUIRED", anon.jsonObject(anonRes).get("code"));

        // MR: must be 403 RBAC_FORBIDDEN
        HttpSessionClient mr = HttpSessionClient.login(base, MR_U, MR_P);
        HttpResponse<String> mrRes = mr.postJson(
                "/analytics/company-overview",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(403, mrRes.statusCode(), mrRes.body());
        assertEquals("RBAC_FORBIDDEN", mr.jsonObject(mrRes).get("code"));

        // FM: must be 200
        HttpSessionClient fm = HttpSessionClient.login(base, FM_U, FM_P);
        HttpResponse<String> fmRes = fm.postJson(
                "/analytics/company-overview",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, fmRes.statusCode(), fmRes.body());

        // CM: must be 200
        HttpSessionClient cm = HttpSessionClient.login(base, CM_U, CM_P);
        HttpResponse<String> cmRes = cm.postJson(
                "/analytics/company-overview",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, cmRes.statusCode(), cmRes.body());

        // Basic response-shape checks (don’t depend on seeded data)
        Map<?, ?> body = cm.jsonObject(cmRes);
        assertNotNull(body.get("periodUsed"));
        assertNotNull(body.get("scope"));

        Object barsObj = body.get("coverageByGrade");
        assertTrue(barsObj instanceof List, "coverageByGrade must be a list");
        assertEquals(3, ((List<?>) barsObj).size(), "coverageByGrade must always include A/B/C bars");
    }

    @Test
    void drilldown_endpoints_exist_and_return_json() throws Exception {
        String base = apiBase();
        HttpSessionClient cm = HttpSessionClient.login(base, CM_U, CM_P);

        // doctor-details (POST)
        HttpResponse<String> dd = cm.postJson(
                "/analytics/doctor-details",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, dd.statusCode(), dd.body());
        Map<?, ?> ddBody = cm.jsonObject(dd);
        assertNotNull(ddBody.get("rows"));
        assertNotNull(ddBody.get("flags"));

        // rep-details (POST)
        HttpResponse<String> rd = cm.postJson(
                "/analytics/rep-details",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, rd.statusCode(), rd.body());
        Map<?, ?> rdBody = cm.jsonObject(rd);
        assertNotNull(rdBody.get("rows"));
        assertNotNull(rdBody.get("flags"));

        // product-details is currently a placeholder (still must be 200)
        HttpResponse<String> pd = cm.postJson(
                "/analytics/product-details",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, pd.statusCode(), pd.body());

        // chemist-details is currently a placeholder (still must be 200)
        HttpResponse<String> cd = cm.postJson(
                "/analytics/chemist-details",
                "{\"period\":\"THIS_MONTH\"}",
                Map.of()
        );
        assertEquals(200, cd.statusCode(), cd.body());

        // visit-log unknown doctor id should be 404 DOCTOR_NOT_FOUND
        HttpResponse<String> vl = cm.get("/analytics/doctors/999999/visit-log");
        assertEquals(404, vl.statusCode(), vl.body());
        assertEquals("DOCTOR_NOT_FOUND", cm.jsonObject(vl).get("code"));
    }
}
