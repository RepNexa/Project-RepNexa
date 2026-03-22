package com.repnexa.testsupport;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public final class HttpSessionClient {

    private static final ObjectMapper OM = new ObjectMapper();

    private final String apiBase; // e.g. http://localhost:12345/api/v1
    private final HttpClient client;
    private final boolean autoCsrf;
    private String csrfToken; // cached; refreshed on demand

    private HttpSessionClient(String apiBase, HttpClient client, boolean autoCsrf) {
        this.apiBase = apiBase;
        this.client = client;
        this.autoCsrf = autoCsrf;
    }

    public static HttpSessionClient anonymous(String apiBase) {
        HttpClient c = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        return new HttpSessionClient(apiBase, c, false);
    }

    public static HttpSessionClient login(String apiBase, String username, String password) throws Exception {
        CookieManager cm = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient c = HttpClient.newBuilder()
                .cookieHandler(cm)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();

        HttpSessionClient s = new HttpSessionClient(apiBase, c, true);
        String csrf = s.ensureCsrfToken();

        String body = OM.writeValueAsString(Map.of("username", username, "password", password));
        HttpResponse<String> res = s.postJsonNoCsrf("/auth/login", body, Map.of("X-CSRF-Token", csrf));

        assertEquals(200, res.statusCode(), "login must be 200. body=" + res.body());
        return s;
    }

    public HttpResponse<String> get(String path) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(apiBase + path))
                .GET()
                .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    /**
     * POST JSON. If this client is authenticated (created via login()), automatically
     * attaches X-CSRF-Token unless caller already provided it.
     */
    public HttpResponse<String> postJson(String path, String json, Map<String, String> extraHeaders) throws Exception {
        Map<String, String> headers = extraHeaders == null ? Map.of() : extraHeaders;

        if (autoCsrf && !headers.containsKey("X-CSRF-Token")) {
            String t = ensureCsrfToken();
            headers = new java.util.HashMap<>(headers);
            headers.put("X-CSRF-Token", t);
        }

        return postJsonNoCsrf(path, json, headers);
    }

    /**
     * POST JSON WITHOUT any CSRF auto-attachment (use for anonymous probes or explicit CSRF-negative tests).
     */
    public HttpResponse<String> postJsonNoCsrf(String path, String json, Map<String, String> extraHeaders) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create(apiBase + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));

        if (extraHeaders != null) {
            for (var e : extraHeaders.entrySet()) {
                b.header(e.getKey(), e.getValue());
            }
        }

        return client.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    public Map<?, ?> jsonObject(HttpResponse<String> res) throws Exception {
        return OM.readValue(res.body(), Map.class);
    }

    private String ensureCsrfToken() throws Exception {
        if (this.csrfToken != null && !this.csrfToken.isBlank()) {
            return this.csrfToken;
        }

        HttpResponse<String> res = get("/auth/csrf");
        assertEquals(200, res.statusCode(), "csrf endpoint must be 200. body=" + res.body());
        Map<?, ?> m = OM.readValue(res.body(), Map.class);
        Object t = m.get("token");
        assertNotNull(t, "csrf response must contain token");
        this.csrfToken = String.valueOf(t);
        return this.csrfToken;
    }
}
