package com.repnexa.modules.meta.dto;

import com.repnexa.modules.auth.domain.UserRole;

public record MeResponse(
        Long id,
        String username,
        UserRole role,
        boolean mustChangePassword
) {}
