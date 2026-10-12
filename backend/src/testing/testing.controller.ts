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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { TestsService } from './tests.service';
import { CreateTestDto, UpdateTestDto } from './dto/test.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('testing')
export class TestingController {
  constructor(private service: TestsService) {}

  @Permissions('testing.view')
  @Get('tests')
  list(@Req() req: any) {
    return this.service.list(req.user);
  }

  @Permissions('testing.edit')
  @Get('manage/tests')
  manageList(@Req() req: any, @Query('status') status?: string) {
    return this.service.manageList(req.user, status);
  }

  @Permissions('testing.edit')
  @Get('manage/options')
  options(@Req() req: any) {
    return this.service.options(req.user);
  }

  @Permissions('testing.edit')
  @Get('manage/tests/:id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.getForEdit(req.user, id);
  }

  @Permissions('testing.create')
  @Post('manage/tests')
  create(@Req() req: any, @Body() dto: CreateTestDto) {
    return this.service.create(req.user, dto);
  }

  @Permissions('testing.edit')
  @Patch('manage/tests/:id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.service.update(req.user, id, dto);
  }

  @Permissions('testing.publish')
  @Post('manage/tests/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publish(req.user, id);
  }

  @Permissions('testing.archive')
  @Post('manage/tests/:id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(req.user, id);
  }

  @Permissions('testing.archive')
  @Post('manage/tests/:id/restore')
  restore(@Req() req: any, @Param('id') id: string) {
    return this.service.restore(req.user, id);
  }

  @Permissions('testing.delete')
  @Delete('manage/tests/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user, id);
  }
}