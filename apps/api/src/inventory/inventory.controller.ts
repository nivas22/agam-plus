import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { RequiresModule } from '../auth/decorators/requires-module.decorator';
import { HOSPITAL_MODULE } from '../constants';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  adjustInventoryBatchSchema,
  createInventoryItemSchema,
  inventoryItemStatusSchema,
  issueInventoryStockSchema,
  receiveInventoryStockSchema,
  updateInventoryItemSchema,
} from '../common/validation/schemas';

// Staff-console only for v1 — doctors don't see inventory. Anyone on the
// console can read stock; each kind of change is its own permission so a
// hospital can let nurses issue stock without letting them write it off.
@Controller('hospitals/:id/inventory')
@UseGuards(HospitalContextGuard, PermissionGuard)
@Roles('admin', 'front_desk', 'nurse', 'accountant')
@RequiresModule(HOSPITAL_MODULE.INVENTORY)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  summary(@Param('id') hospitalId: string) {
    return this.inventoryService.getSummary(hospitalId);
  }

  @Get('items')
  listItems(
    @Param('id') hospitalId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('stock') stock?: string,
  ) {
    return this.inventoryService.listItems(hospitalId, {
      category,
      status,
      search,
      stock,
    });
  }

  @Get('items/:itemId')
  getItem(@Param('id') hospitalId: string, @Param('itemId') itemId: string) {
    return this.inventoryService.getItem(hospitalId, itemId);
  }

  @Get('batches/expiring')
  expiringBatches(
    @Param('id') hospitalId: string,
    @Query('withinDays') withinDays?: string,
  ) {
    return this.inventoryService.listExpiringBatches(
      hospitalId,
      withinDays ? Number(withinDays) : undefined,
    );
  }

  @Get('movements')
  listMovements(
    @Param('id') hospitalId: string,
    @Query('itemId') itemId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.listMovements(hospitalId, {
      itemId,
      type,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('items')
  @RequirePermission('manage_inventory_items')
  @UsePipes(new ZodValidationPipe(createInventoryItemSchema))
  createItem(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.inventoryService.createItem(hospitalId, userProfile, body);
  }

  @Put('items/:itemId')
  @RequirePermission('manage_inventory_items')
  @UsePipes(new ZodValidationPipe(updateInventoryItemSchema))
  updateItem(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.inventoryService.updateItem(
      hospitalId,
      itemId,
      userProfile,
      body,
    );
  }

  @Patch('items/:itemId/status')
  @RequirePermission('manage_inventory_items')
  @UsePipes(new ZodValidationPipe(inventoryItemStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'archived' },
  ) {
    return this.inventoryService.setStatus(
      hospitalId,
      itemId,
      userProfile,
      body.status,
    );
  }

  @Post('items/:itemId/receive')
  @RequirePermission('receive_stock')
  @UsePipes(new ZodValidationPipe(receiveInventoryStockSchema))
  receive(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.inventoryService.receiveStock(
      hospitalId,
      userProfile,
      itemId,
      body,
    );
  }

  @Post('items/:itemId/issue')
  @RequirePermission('issue_stock')
  @UsePipes(new ZodValidationPipe(issueInventoryStockSchema))
  issue(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.inventoryService.issueStock(
      hospitalId,
      userProfile,
      itemId,
      body,
    );
  }

  @Post('items/:itemId/batches/:batchId/adjust')
  @RequirePermission('adjust_stock')
  @UsePipes(new ZodValidationPipe(adjustInventoryBatchSchema))
  adjust(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @Param('batchId') batchId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.inventoryService.adjustBatch(
      hospitalId,
      userProfile,
      itemId,
      batchId,
      body,
    );
  }
}
