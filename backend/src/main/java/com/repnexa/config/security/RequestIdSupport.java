package com.repnexa.config.security;

import jakarta.servlet.http.HttpServletRequest;

final class RequestIdSupport {
    private RequestIdSupport() {}

    static String requestId(HttpServletRequest request) {
        Object attr = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTR);
        if (attr instanceof String s && !s.isBlank()) return s;

        String header = request.getHeader(RequestIdFilter.REQUEST_ID_HEADER);
        return (header == null || header.isBlank()) ? null : header;
    }
}
