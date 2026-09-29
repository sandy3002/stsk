import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StudentsService } from './students.service.js';

export type StudentStatus = 'passed' | 'failed' | 'pending';

export class CreateStudentDto {
  name: string;
  beltRank?: string;
  nextExamDate?: string;
  classesRequired?: number;
  classesAttended?: number;
  status?: StudentStatus;
}

export class UpdateStudentDto extends CreateStudentDto {}

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Roles('admin', 'viewer')
  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Roles('admin', 'viewer')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }
}
