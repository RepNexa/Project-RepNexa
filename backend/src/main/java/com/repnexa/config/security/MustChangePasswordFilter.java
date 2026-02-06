package com.repnexa.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.common.api.ApiErrorWriter;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

public class MustChangePasswordFilter extends OncePerRequestFilter {

    private final ObjectMapper mapper;

    private static final Set<String> ALLOWED_PREFIXES = Set.of(
            "/api/v1/auth/csrf",
            "/api/v1/auth/login",
            "/api/v1/auth/logout",
            "/api/v1/auth/change-password",
            "/api/v1/me",
            "/actuator/health"
    );

    public MustChangePasswordFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof RepnexaUserDetails u) {
            if (u.mustChangePassword() && !isAllowed(request.getRequestURI())) {
                String reqId = null;
                Object attr = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTR);
                if (attr instanceof String s && !s.isBlank()) reqId = s;
                if (reqId == null || reqId.isBlank()) reqId = request.getHeader(RequestIdFilter.REQUEST_ID_HEADER);
                ApiErrorWriter.write(
                        mapper,
                        response,
                        403,
                        "Forbidden",
                        "MUST_CHANGE_PASSWORD",
                        "Password change required before continuing",
                        request.getRequestURI(),
                        reqId,
                        java.util.List.of()
                );
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean isAllowed(String uri) {
        return ALLOWED_PREFIXES.stream().anyMatch(uri::startsWith);
    }
}
