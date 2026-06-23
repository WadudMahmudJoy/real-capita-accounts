import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { BookableItemService } from "./bookable-item.service";
import { CreateBookableItemDto } from "./dto/create-bookable-item.dto";
import { ListBookableItemsQueryDto } from "./dto/list-bookable-items-query.dto";
import { UpdateBookableItemDto } from "./dto/update-bookable-item.dto";

@Controller("bookable-items")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class BookableItemController {
  constructor(private readonly bookableItemService: BookableItemService) {}

  @Get()
  findAll(@Query() query: ListBookableItemsQueryDto) {
    return this.bookableItemService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.bookableItemService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBookableItemDto) {
    return this.bookableItemService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBookableItemDto) {
    return this.bookableItemService.update(id, dto);
  }
}
