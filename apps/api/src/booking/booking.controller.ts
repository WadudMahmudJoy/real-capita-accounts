import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { BookingService } from "./booking.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { CreateReceiptAllocationDto } from "./dto/create-receipt-allocation.dto";
import { ListBookingsQueryDto } from "./dto/list-bookings-query.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";

@Controller("bookings")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  findAll(@Query() query: ListBookingsQueryDto) {
    return this.bookingService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.bookingService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookingService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingService.update(id, dto);
  }

  @Get(":id/receipt-allocations")
  findReceiptAllocations(@Param("id") id: string) {
    return this.bookingService.findReceiptAllocations(id);
  }

  @Post(":id/receipt-allocations")
  createReceiptAllocation(
    @Param("id") id: string,
    @Body() dto: CreateReceiptAllocationDto,
  ) {
    return this.bookingService.createReceiptAllocation(id, dto);
  }

  @Delete(":id/receipt-allocations/:allocationId")
  @HttpCode(HttpStatus.OK)
  deleteReceiptAllocation(
    @Param("id") id: string,
    @Param("allocationId") allocationId: string,
  ) {
    return this.bookingService.deleteReceiptAllocation(id, allocationId);
  }
}
