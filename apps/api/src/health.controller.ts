import { Controller, Get } from "@nestjs/common";

type HealthResponse = {
  status: "ok";
  service: "real-capita-accounts-api";
  timestamp: string;
  environment: string;
};

@Controller()
export class HealthController {
  @Get("health")
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "real-capita-accounts-api",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
    };
  }
}
