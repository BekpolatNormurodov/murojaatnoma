import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminRole } from '@prisma/client';
import { AdminWriterGuard } from '../../common/guards/admin-writer.guard';
import { UpsertEmployeeDto } from '../oversight/dto/upsert-employee.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

/** Same options as main.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const check = (metatype: ArgumentMetadata['metatype'], body: unknown) =>
  pipe.transform(body, { type: 'body', metatype });

const person = {
  fullName: 'Aliyev Ali',
  phone: '+998901234567',
  position: 'Inspektor',
  region: 'Toshkent shahri',
  district: 'Mirzo Ulug‘bek',
};

describe('xodimlar — ruxsatlar', () => {
  const guardsOf = (method: keyof EmployeesController): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, EmployeesController.prototype[method]) ?? [];

  it('qo‘shish, tahrirlash, o‘chirish — faqat SUPER_ADMIN / ADMIN', () => {
    for (const method of ['create', 'update', 'remove'] as const) {
      expect(guardsOf(method)).toContain(AdminWriterGuard);
    }
    for (const method of [
      'findAll',
      'findOne',
      'enrollFace',
      'findFaceTemplates',
    ] as const) {
      expect(guardsOf(method)).not.toContain(AdminWriterGuard);
    }
    const allows = (adminRole: AdminRole) =>
      new AdminWriterGuard().canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ user: { scope: 'admin', adminRole } }),
        }),
      } as never);
    expect(allows(AdminRole.VIEWER)).toBe(false);
    expect(allows(AdminRole.ADMIN)).toBe(true);
    expect(allows(AdminRole.SUPER_ADMIN)).toBe(true);
  });
});

describe('xodimlar — hudud qiymati tekshiruvi', () => {
  const oversight = { fullName: 'Aliyev Ali', position: 'Inspektor' };

  it.each([
    ['POST /employees', CreateEmployeeDto, person],
    ['PATCH /employees/:id', UpdateEmployeeDto, {}],
    ['oversight', UpsertEmployeeDto, oversight],
  ])('%s: null — 400; [] va tushirib qoldirish — mumkin', async (_name, dto, base) => {
    await expect(
      check(dto, { ...base, assignedMahallaCodes: null }),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      check(dto, { ...base, assignedMahallaCodes: [] }),
    ).resolves.toMatchObject({
      assignedMahallaCodes: [],
    });
    const omitted = await check(dto, { ...base });
    expect(omitted.assignedMahallaCodes).toBeUndefined();
  });

  it('PATCH qolgan maydonlari ixtiyoriyligicha qoladi', async () => {
    await expect(check(UpdateEmployeeDto, { isActive: false })).resolves.toEqual({
      isActive: false,
    });
    await expect(check(UpdateEmployeeDto, { fullName: 'A' })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('xodimlar — hudud yozish', () => {
  const row = {
    id: 'e1',
    passwordHash: 'x',
    assignedMahallaCodes: ['M1'],
    lastInsideAssignedZone: true,
    lastInsideOffice: false,
    lastLocationAt: new Date(),
    _count: { faceTemplates: 0 },
  };

  function build() {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row }),
        create: jest.fn().mockResolvedValue(row),
      },
    };
    const order: string[] = [];
    const locations = {
      normalizeMahallaCodes: jest.fn((codes: string[]) =>
        Promise.resolve([...new Set(codes)]),
      ),
      reevaluateTerritory: jest.fn(() => {
        order.push('reevaluate');
        return Promise.resolve({
          insideAssignedZone: false,
          insideOffice: true,
          fixesUpdated: 1,
        });
      }),
      territoryChanged: jest.fn(() => {
        order.push('notify');
        return Promise.resolve(true);
      }),
    };
    const service = new EmployeesService(prisma as never, locations as never);
    return { service, prisma, locations, order };
  }

  it('create ham mahalla kodlarini tekshiradi', async () => {
    const { service, prisma, locations } = build();
    await service.create({ ...person, assignedMahallaCodes: ['M2', 'M2'] });
    expect(locations.normalizeMahallaCodes).toHaveBeenCalledWith(['M2', 'M2']);
    expect(prisma.employee.create.mock.calls[0][0].data.assignedMahallaCodes).toEqual([
      'M2',
    ]);
    expect(locations.territoryChanged).not.toHaveBeenCalled();
  });

  it('update: yangi belgilar javobda; xabar eski va yangi to‘plam bilan', async () => {
    const { service, locations, order } = build();
    const res = await service.update('e1', { assignedMahallaCodes: ['M2'] });
    expect(res).toMatchObject({ lastInsideAssignedZone: false, lastInsideOffice: true });
    expect(res).not.toHaveProperty('passwordHash');
    expect(locations.territoryChanged).toHaveBeenCalledWith('e1', ['M1'], ['M2']);
    expect(order).toEqual(['reevaluate', 'notify']);
  });

  it('hudud yuborilmasa — qayta hisob ham, xabar ham yo‘q', async () => {
    const { service, locations } = build();
    await service.update('e1', { position: 'Bosh inspektor' });
    expect(locations.reevaluateTerritory).not.toHaveBeenCalled();
    expect(locations.territoryChanged).not.toHaveBeenCalled();
  });
});
