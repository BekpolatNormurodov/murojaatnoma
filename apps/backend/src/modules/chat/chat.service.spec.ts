import { ChatConvKind } from '@prisma/client';
import { ChatService } from './chat.service';

function conv(id: string, over: Record<string, unknown> = {}, lastAt?: Date) {
  return {
    id,
    kind: id === 'group-all' ? ChatConvKind.group : ChatConvKind.direct,
    title: id,
    subtitle: null,
    avatarColor: null,
    photo: null,
    staffId: null,
    online: false,
    archived: false,
    archivedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    messages: lastAt ? [{ id: `${id}-m`, conversationId: id, senderId: 'me', createdAt: lastAt }] : [],
    ...over,
  };
}

function build(conversations: unknown[], employees: unknown[]) {
  const prisma = {
    chatConversation: {
      findMany: jest.fn((args: { where?: { id?: unknown } }) =>
        Promise.resolve(
          args.where?.id
            ? (conversations as { id: string }[])
                .filter((c) => c.id.startsWith('dm-emp-'))
                .map((c) => ({ id: c.id }))
            : conversations,
        ),
      ),
      count: jest.fn().mockResolvedValue(0),
    },
    chatMessage: {
      groupBy: jest.fn().mockResolvedValue([{ conversationId: 'dm-emp-a', _count: { _all: 2 } }]),
      count: jest.fn().mockResolvedValue(0),
    },
    chatReadCursor: { findUnique: jest.fn().mockResolvedValue(null) },
    employee: {
      findMany: jest.fn().mockResolvedValue(employees),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return new ChatService(prisma as never, { emit: jest.fn() } as never);
}

describe('ChatService.findAllConversations (admin list)', () => {
  const employees = [
    { id: 'a', fullName: 'ГУЛЯМОВ Абдулазиз', avatarUrl: 'https://x/a.png', position: 'Bosh mutaxassis' },
    { id: 'b', fullName: 'САБУРОВ Хосилбек', avatarUrl: null, position: 'Inspektor' },
  ];

  it('drops demo/orphan threads, shows every active employee with live identity', async () => {
    const service = build(
      [
        conv('group-all', {}, new Date(1000)),
        conv('dm-s1', { title: 'Akmal Hokimov', photo: 'https://randomuser.me/x.jpg' }, new Date(5000)),
        conv('dm-emp-a', { title: 'Gulyamov', staffId: 'a' }, new Date(3000)),
        conv('dm-emp-deleted', { title: 'Aziz Karimov' }, new Date(4000)),
        conv('dm-citizen-c1', { title: 'Fuqaro' }, new Date(2000)),
      ],
      employees,
    );

    const list = await service.findAllConversations(false);
    const ids = list.map((c) => c.id);

    expect(ids).toEqual(['group-all', 'dm-emp-a', 'dm-citizen-c1', 'dm-emp-b']);
    const a = list.find((c) => c.id === 'dm-emp-a')!;
    expect(a).toMatchObject({
      title: 'ГУЛЯМОВ Абдулазиз',
      photo: 'https://x/a.png',
      subtitle: 'Bosh mutaxassis',
      unreadCount: 2,
    });
    expect(list.find((c) => c.id === 'dm-emp-b')).toMatchObject({
      title: 'САБУРОВ Хосилбек',
      staffId: 'b',
      lastMessage: null,
    });
  });

  it('archive view lists only stored archived threads (no placeholders)', async () => {
    const service = build([conv('dm-emp-a', { archived: true, staffId: 'a' })], employees);
    const list = await service.findAllConversations(true);
    expect(list.map((c) => c.id)).toEqual(['dm-emp-a']);
  });

  it('an employee DM nobody wrote in yet reads as empty, not 404', async () => {
    const service = build([], employees);
    await expect(service.findMessages('dm-emp-b', {})).resolves.toEqual([]);
    await expect(service.markRead('dm-emp-b')).resolves.toEqual({ ok: true });
  });
});
