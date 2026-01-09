package com.repnexa;

import org.springframework.boot.SpringApplication;

public class TestRepnexaApplication {

	public static void main(String[] args) {
		SpringApplication.from(RepnexaApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
