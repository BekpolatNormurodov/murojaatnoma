import { MeetingParticipant, MeetingRoomService } from './meetings-room.service';

const admin = (id: string): MeetingParticipant => ({
  id: `admin:${id}`,
  name: `Admin ${id}`,
  scope: 'admin',
  audio: true,
  video: true,
});
const emp = (id: string): MeetingParticipant => ({ id, name: id, scope: 'employee', audio: true, video: true });

describe('MeetingRoomService', () => {
  it('two admins are two participants (no "me" collapse) and mesh with each other', () => {
    const rooms = new MeetingRoomService();
    expect(rooms.join('m1', 's1', admin('a'))).toEqual([]);
    const seen = rooms.join('m1', 's2', admin('b'));
    expect(seen.map((p) => p.id)).toEqual(['admin:a']);
    expect(rooms.participants('m1')).toHaveLength(2);
  });

  it('employees need an invite; "all" lets everyone in; admins always', () => {
    const rooms = new MeetingRoomService();
    expect(rooms.canJoin('m1', emp('e1'))).toBe(false); // no room yet
    rooms.open('m1', { title: 'T', media: 'video', hostId: 'admin:a', hostName: 'A', invited: new Set(['e1']) });
    expect(rooms.canJoin('m1', emp('e1'))).toBe(true);
    expect(rooms.canJoin('m1', emp('e2'))).toBe(false);
    expect(rooms.canJoin('m1', admin('z'))).toBe(true);

    rooms.open('m1', { title: 'T', media: 'video', hostId: 'admin:a', hostName: 'A', invited: 'all' });
    expect(rooms.canJoin('m1', emp('e2'))).toBe(true);
  });

  it('a second device of the same person is one participant and keeps their media state', () => {
    const rooms = new MeetingRoomService();
    rooms.join('m1', 's1', admin('a'));
    rooms.join('m1', 'p1', emp('e1'));
    rooms.setMedia('m1', 'e1', false, true);
    rooms.join('m1', 'p2', emp('e1'));
    expect(rooms.participants('m1')).toHaveLength(2);
    expect(rooms.participants('m1').find((p) => p.id === 'e1')).toMatchObject({ audio: false, video: true });
    expect(rooms.socketsFor('m1', 'e1').sort()).toEqual(['p1', 'p2']);

    // leaving one device: still there; leaving the last: gone
    expect(rooms.leave('m1', 'p1')).toMatchObject({ gone: false, empty: false });
    expect(rooms.leave('m1', 'p2')).toMatchObject({ gone: true, empty: false });
  });

  it('the room disappears when the last person leaves; info counts people', () => {
    const rooms = new MeetingRoomService();
    rooms.open('m1', { title: 'Selektor', media: 'audio', hostId: 'admin:a', hostName: 'A', invited: 'all' });
    rooms.join('m1', 's1', admin('a'));
    rooms.join('m1', 'p1', emp('e1'));
    expect(rooms.info('m1')).toMatchObject({ title: 'Selektor', media: 'audio', count: 2 });
    expect(rooms.activeFor(emp('e9')).map((m) => m.meetingId)).toEqual(['m1']);

    rooms.leave('m1', 's1');
    const last = rooms.leave('m1', 'p1');
    expect(last).toMatchObject({ empty: true });
    expect(rooms.info('m1')).toBeNull();
    expect(rooms.meetingsOf('p1')).toEqual([]);
  });

  it('end() closes the room for everyone and reports the host', () => {
    const rooms = new MeetingRoomService();
    rooms.join('m1', 's1', admin('a'));
    expect(rooms.isHost('m1', 'admin:a')).toBe(true);
    expect(rooms.end('m1')).toMatchObject({ hostId: 'admin:a' });
    expect(rooms.end('m1')).toBeNull();
  });
});
