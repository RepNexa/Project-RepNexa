package com.repnexa.modules.auth.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.repnexa.modules.auth.domain.User;
import com.repnexa.modules.auth.dto.ChangePasswordRequest;
import com.repnexa.modules.auth.repo.UserRepository;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.auth.dto.MeResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Service
public class AuthService {

    private final AuthenticationManager authManager;
    private final UserRepository users;
    private final PasswordEncoder encoder;

    public AuthService(AuthenticationManager authManager, UserRepository users, PasswordEncoder encoder) {
        this.authManager = authManager;
        this.users = users;
        this.encoder = encoder;
    }

    public MeResponse me(RepnexaUserDetails u) {
         return new MeResponse(u.id(), u.username(), u.role(), u.mustChangePassword());
     }

    public MeResponse login(String username, String password) {
        var token = new UsernamePasswordAuthenticationToken(username, password);
        var auth = authManager.authenticate(token);
        SecurityContextHolder.getContext().setAuthentication(auth);

        var u = (RepnexaUserDetails) auth.getPrincipal();
        return new MeResponse(u.id(), u.username(), u.role(), u.mustChangePassword());
    }

    public void logout(HttpServletRequest req, HttpServletResponse res) {
        new SecurityContextLogoutHandler().logout(req, res, SecurityContextHolder.getContext().getAuthentication());
    }

    @Transactional
    public MeResponse changePassword(ChangePasswordRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        RepnexaUserDetails principal = (RepnexaUserDetails) auth.getPrincipal();

        User u = users.findById(principal.id()).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            // Use BadCredentialsException to reuse 401 error mapping
            throw new org.springframework.security.authentication.BadCredentialsException("Bad current password");
        }

        u.setPasswordHash(encoder.encode(req.newPassword()));
        u.setMustChangePassword(false);
        users.save(u);

        // Refresh principal in the session so /me reflects mustChangePassword=false immediately
        RepnexaUserDetails updatedPrincipal = new RepnexaUserDetails(
               u.getId(),
                u.getUsername(),
                u.getPasswordHash(),
                u.getRole(),
                u.isEnabled(),
                u.isMustChangePassword()
        );
        var updatedAuth = new UsernamePasswordAuthenticationToken(
                updatedPrincipal,
                auth.getCredentials(),
                updatedPrincipal.getAuthorities()
        );
        updatedAuth.setDetails(auth.getDetails());
        SecurityContextHolder.getContext().setAuthentication(updatedAuth);

        return new MeResponse(u.getId(), u.getUsername(), u.getRole(), u.isMustChangePassword());
    }
}
