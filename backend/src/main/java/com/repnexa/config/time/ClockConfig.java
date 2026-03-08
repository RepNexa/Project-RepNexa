package com.repnexa.config.time;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ClockConfig {

    @Value("${REPNEXA_APP_TIMEZONE:Asia/Colombo}")
    private String appTimeZone;

    @Bean
    public Clock systemClock() {
        return Clock.system(ZoneId.of(appTimeZone));
    }
}
