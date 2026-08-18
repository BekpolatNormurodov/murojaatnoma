import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { EmployeesService, EmployeeWithFace } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EnrollFaceDto } from './dto/enroll-face.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/**
 * Staff directory + biometric enrollment.
 *
 * SECURITY: the whole controller is `@RequireScope('admin')` — the full
 * roster and any employee's profile/PII are web-admin territory, never
 * reachable by a mobile employee token. The two face-template routes
 * override that to `('employee', 'admin')` and then enforce OWNER-OR-ADMIN
 * in-handler (`assertCanManageFace`): a mobile employee may enroll/read only
 * their OWN `:id`; an admin may act on any. This closes the biometric-
 * embedding + PII leak where any authenticated token reached every route.
 */
@ApiTags('employees')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * Owner-or-admin gate for the face-template routes: an `admin`-scope token
   * may target any employee id; any other principal (a mobile `employee`) may
   * target ONLY its own id. Throws 403 otherwise. Employee identity comes from
   * the verified JWT subject (`user.employeeId`), never from client input.
   */
  private assertCanManageFace(user: AuthenticatedUser, targetId: string): void {
    if (user.scope === 'admin') return;
    if (user.employeeId === targetId) return;
    throw new ForbiddenException(
      'You may only access your own face template.',
    );
  }

  @Post()
  @Roles(EmployeeRole.ADMIN)
  @ApiOperation({ summary: 'Register a new employee (Xodim)' })
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees with optional region/district filter' })
  findAll(
    @Query() query: ListEmployeesQueryDto,
  ): Promise<Paginated<EmployeeWithFace>> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee profile by id' })
  findOne(@Param('id') id: string): Promise<EmployeeWithFace> {
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
  @RequireScope('employee', 'admin')
  @ApiOperation({ summary: 'Enroll a face-recognition embedding (own id, or admin)' })
  enrollFace(
    @Param('id') id: string,
    @Body() dto: EnrollFaceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FaceTemplate> {
    this.assertCanManageFace(user, id);
    return this.employeesService.enrollFace(id, dto);
  }

  @Get(':id/face-template')
  @RequireScope('employee', 'admin')
  @ApiOperation({ summary: 'List enrolled face templates (own id, or admin)' })
  findFaceTemplates(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FaceTemplate[]> {
    this.assertCanManageFace(user, id);
    return this.employeesService.findFaceTemplates(id);
  }
}
