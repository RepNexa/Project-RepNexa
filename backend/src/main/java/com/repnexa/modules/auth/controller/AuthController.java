package com.repnexa.modules.auth.controller;

import com.repnexa.modules.auth.dto.ChangePasswordRequest;
import com.repnexa.modules.auth.dto.CsrfResponse;
import com.repnexa.modules.auth.dto.LoginRequest;
import com.repnexa.modules.auth.service.AuthService;
import com.repnexa.modules.auth.dto.MeResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public MeResponse login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        // Ensure an HTTP session exists so auth can persist for /me
        request.getSession(true);

        String username = body.get("username");
        String password = body.get("password");
        return auth.login(username, password);
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
