import { ForbiddenException } from '@nestjs/common';
import { AdminRole, EmployeeRole } from '@prisma/client';
import { AttendanceController } from '../../modules/attendance/attendance.controller';
import { EmployeesController } from '../../modules/employees/employees.controller';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const admin = (adminRole: AdminRole): AuthenticatedUser => ({
  employeeId: 'admin-1',
  phone: '',
  role: EmployeeRole.ADMIN,
  scope: 'admin',
  adminRole,
});

describe('VIEWER cannot write on behalf of an employee', () => {
  const attendance = { checkIn: jest.fn(), checkOut: jest.fn(), verifyFace: jest.fn() };
  const employees = { enrollFace: jest.fn() };
  const a = new AttendanceController(attendance as never);
  const e = new EmployeesController(employees as never);
  const body = { employeeId: 'emp-2' } as never;

  beforeEach(() => jest.clearAllMocks());

  it('rejects check-in, check-out, verify-face and face enrolment', () => {
    const viewer = admin(AdminRole.VIEWER);
    expect(() => a.checkIn(viewer, body)).toThrow(ForbiddenException);
    expect(() => a.checkOut(viewer, body)).toThrow(ForbiddenException);
    expect(() => a.verifyFace(viewer, body)).toThrow(ForbiddenException);
    expect(() => e.enrollFace('emp-2', {} as never, viewer)).toThrow(ForbiddenException);
    expect(attendance.checkIn).not.toHaveBeenCalled();
    expect(employees.enrollFace).not.toHaveBeenCalled();
  });

  it('still allows a writing admin and an employee acting on themself', () => {
    void a.checkIn(admin(AdminRole.ADMIN), body);
    expect(attendance.checkIn).toHaveBeenCalledWith('emp-2', body);
    const self: AuthenticatedUser = {
      employeeId: 'emp-2',
      phone: '',
      role: EmployeeRole.EMPLOYEE,
      scope: 'employee',
    };
    void e.enrollFace('emp-2', {} as never, self);
    expect(employees.enrollFace).toHaveBeenCalled();
  });
});
