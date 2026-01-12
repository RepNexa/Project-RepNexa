package com.repnexa.modules.auth.security;

import com.repnexa.modules.auth.repo.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class RepnexaUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public RepnexaUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var u = users.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return new RepnexaUserDetails(
                u.getId(),
                u.getUsername(),
                u.getPasswordHash(),
                u.getRole(),
                u.isEnabled(),
                u.isMustChangePassword()
        );
    }
}
