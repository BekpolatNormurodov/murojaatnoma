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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Employee, EmployeeRole, FaceTemplate } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EnrollFaceDto } from './dto/enroll-face.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(EmployeeRole.ADMIN)
  @ApiOperation({ summary: 'Register a new employee (Xodim)' })
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees with optional region/district filter' })
  findAll(@Query() query: ListEmployeesQueryDto): Promise<Paginated<Employee>> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee profile by id' })
  findOne(@Param('id') id: string): Promise<Employee> {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @Roles(EmployeeRole.ADMIN)
  @ApiOperation({ summary: 'Update an employee profile' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto): Promise<Employee> {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(EmployeeRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an employee' })
  remove(@Param('id') id: string): Promise<void> {
    return this.employeesService.remove(id);
  }

  @Post(':id/face-template')
  @ApiOperation({ summary: 'Enroll a face-recognition embedding for an employee' })
  enrollFace(@Param('id') id: string, @Body() dto: EnrollFaceDto): Promise<FaceTemplate> {
    return this.employeesService.enrollFace(id, dto);
  }

  @Get(':id/face-template')
  @ApiOperation({ summary: 'List enrolled face templates for an employee' })
  findFaceTemplates(@Param('id') id: string): Promise<FaceTemplate[]> {
    return this.employeesService.findFaceTemplates(id);
  }
}
