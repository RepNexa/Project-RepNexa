package com.repnexa.modules.auth.controller;

import com.repnexa.modules.auth.dto.ChangePasswordRequest;
import com.repnexa.modules.auth.dto.CsrfResponse;
import com.repnexa.modules.auth.dto.LoginRequest;
import com.repnexa.modules.auth.service.AuthService;
import com.repnexa.modules.meta.dto.MeResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken());
    }

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req.username(), req.password());
    }

    @PostMapping("/logout")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        auth.logout(request, response);
    }

    @PostMapping("/change-password")
    public MeResponse changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        return auth.changePassword(req);
    }
}
