import { PrismaService } from '../../common/prisma/prisma.service';
import { AppSessionsService } from './app-sessions.service';

const at = (h: number) => new Date(Date.UTC(2026, 10, 26, h));
const token = (id: string, extra: object) => ({
  id,
  startedAt: at(1),
  createdAt: at(8),
  expiresAt: at(23),
  device: null,
  platform: null,
  appVersion: null,
  ...extra,
});

describe('AppSessionsService.overview', () => {
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'e1', fullName: 'A', phone: '1', deviceStatus: null, deviceStatusAt: null, lastLocationAt: at(10) },
        { id: 'e2', fullName: 'B', phone: '2', deviceStatus: null, deviceStatusAt: null, lastLocationAt: null },
      ]),
    },
    refreshToken: {
      findMany: jest.fn().mockResolvedValue([token('s1', { employeeId: 'e1', device: 'Redmi' })]),
    },
    citizenRefreshToken: {
      findMany: jest.fn().mockResolvedValue([token('c1', { phone: '+99890', appVersion: '1.2.1' })]),
    },
    application: {
      findMany: jest.fn().mockResolvedValue([
        { applicantPhone: '+99890', applicantFullName: 'Fuqaro', createdAt: at(9) },
        { applicantPhone: '+99891', applicantFullName: 'Boshqa', createdAt: at(2) },
      ]),
    },
  };
  const service = new AppSessionsService(prisma as unknown as PrismaService);

  it('separates employees and citizens with their live sessions', async () => {
    const { employees, citizens } = await service.overview(at(12));

    expect(employees[0]).toMatchObject({ device: 'Redmi', lastSeenAt: at(10) });
    expect(employees[0].sessions).toHaveLength(1);
    expect(employees[1]).toMatchObject({ lastSeenAt: null, sessions: [] });
    expect(citizens.map((c) => [c.name, c.sessions.length, c.applications])).toEqual([
      ['Fuqaro', 1, 1],
      ['Boshqa', 0, 1],
    ]);
    expect(citizens[0].lastSeenAt).toEqual(at(9));
  });

  it('asks only for sessions that are still valid', async () => {
    await service.overview(at(12));
    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revoked: false, expiresAt: { gt: at(12) } } }),
    );
  });
});
