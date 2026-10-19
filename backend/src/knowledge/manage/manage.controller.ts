import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ManageService } from './manage.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { ItemKeyPipe } from '../item-key.pipe';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/manage')
export class ManageController {
  constructor(private service: ManageService) {}

  @Permissions('knowledge.edit')
  @Get('items')
  list(@Req() req: any, @Query('type') type?: string, @Query('status') status?: string) {
    return this.service.list(req.user, type, status);
  }

  @Permissions('knowledge.manage_visibility')
  @Get('options')
  options(@Req() req: any) {
    return this.service.options(req.user);
  }

  @Permissions('knowledge.edit')
  @Get('items/:id')
  get(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.getForEdit(req.user, id);
  }

  @Permissions('knowledge.create')
  @Post('items')
  create(@Req() req: any, @Body() dto: CreateItemDto) {
    return this.service.create(req.user, dto);
  }

  @Permissions('knowledge.edit')
  @Patch('items/:id')
  update(@Req() req: any, @Param('id', ItemKeyPipe) id: string, @Body() dto: UpdateItemDto) {
    return this.service.update(req.user, id, dto);
  }

  @Permissions('knowledge.publish')
  @Post('items/:id/publish')
  publish(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.publish(req.user, id);
  }

  @Permissions('knowledge.archive')
  @Post('items/:id/archive')
  archive(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.archive(req.user, id);
  }

  @Permissions('knowledge.archive')
  @Post('items/:id/restore')
  restore(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.restore(req.user, id);
  }

  @Permissions('knowledge.edit')
  @Post('items/:id/pin')
  pin(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.setPinned(req.user, id, true);
  }

  @Permissions('knowledge.edit')
  @Post('items/:id/unpin')
  unpin(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.setPinned(req.user, id, false);
  }

  @Permissions('knowledge.delete')
  @Delete('items/:id')
  remove(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.remove(req.user, id);
  }
}