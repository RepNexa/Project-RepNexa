package com.repnexa.modules.meta.controller;
 
import com.repnexa.modules.auth.service.AuthService;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.auth.dto.MeResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
 
@RestController
@RequestMapping("/api/v1")
public class MeController {
 
    private final AuthService auth;
 
    public MeController(AuthService auth) {
        this.auth = auth;
    }
 
    @GetMapping("/me")

    public MeResponse me(@AuthenticationPrincipal RepnexaUserDetails user) {
        return auth.me(user);
    }
}
