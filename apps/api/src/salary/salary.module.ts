import { Module } from "@nestjs/common";
import { SalaryCalculator } from "./salary-calculator";
import { SalaryController } from "./salary.controller";
import { SalaryService } from "./salary.service";

@Module({ controllers:[SalaryController], providers:[SalaryCalculator,SalaryService] })
export class SalaryModule {}
