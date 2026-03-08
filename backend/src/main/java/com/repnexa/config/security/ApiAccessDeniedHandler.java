package com.repnexa.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.common.api.ApiErrorWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;

import java.io.IOException;
import java.util.List;

public final class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper;

    public ApiAccessDeniedHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {

        // Key rule:
        // - If CSRF fails and user is anonymous -> 401 AUTH_REQUIRED (not 403 CSRF_INVALID)
        // - If CSRF fails and user is authenticated -> 403 CSRF_INVALID
        if (ex instanceof CsrfException) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean anonymous = (auth == null)
                    || (auth instanceof AnonymousAuthenticationToken)
                    || !auth.isAuthenticated();

            if (anonymous) {
                ApiErrorWriter.write(
                        mapper,
                        response,
                        401,
                        "Unauthorized",
                        "AUTH_REQUIRED",
                        "Authentication required",
                        request.getRequestURI(),
                        RequestIdSupport.requestId(request),
                        List.of()
                );
                return;
            }

            ApiErrorWriter.write(
                    mapper,
                    response,
                    403,
                    "Forbidden",
                    "CSRF_INVALID",
                    "CSRF token missing or invalid",
                    request.getRequestURI(),
                    RequestIdSupport.requestId(request),
                    List.of()
            );
            return;
        }

        ApiErrorWriter.write(
                mapper,
                response,
                403,
                "Forbidden",
                "RBAC_FORBIDDEN",
                "Access denied",
                request.getRequestURI(),
                RequestIdSupport.requestId(request),
                List.of()
        );
    }
}
