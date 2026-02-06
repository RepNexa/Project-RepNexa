package com.repnexa.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_ATTR = "requestId";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String reqId = null;

        Object existingAttr = request.getAttribute(REQUEST_ID_ATTR);
        if (existingAttr instanceof String s && !s.isBlank()) {
            reqId = s;
        } else {
            String header = request.getHeader(REQUEST_ID_HEADER);
            if (header != null && !header.isBlank()) {
                reqId = header;
            }
        }

        if (reqId == null || reqId.isBlank() || !isUuid(reqId)) {
            reqId = UUID.randomUUID().toString();
        }

        request.setAttribute(REQUEST_ID_ATTR, reqId);
        response.setHeader(REQUEST_ID_HEADER, reqId);

        filterChain.doFilter(request, response);
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
