/* eslint-disable */
/**
 * Trim the mock web-admin fixtures down to a handful of REAL Mirzo test rows:
 *   - Meetings  : replace all mock with 3 realistic Mirzo meetings (chair = a
 *                 real seeded staff id, participants count).
 *   - Complaints: keep the 3 newest, delete the rest (cascade cleans threads).
 *   - Requests  : keep 3, pin them to the Mirzo district so they show in the
 *                 district-scoped murojaatlar view; delete the rest.
 *
 * Idempotent enough to re-run. Run inside the backend container:
 *   docker compose exec backend node prisma/seed-test-fixtures.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISTRICT = 'mirzo';
const CHAIR = 'mirzo-gulyamov'; // a real seeded Staff id
const CHAIR_NAME = 'ГУЛЯМОВ Абдулазиз Исмаилович';
// Real seeded staff (subset of the 29) used as meeting participants.
const P1 = ['ПУЛАТОВ Нигматжон Набиджанович', 'ХУСАИНОВ Сарварбек Эрназарович', 'НАЗАРОВ Бехзод Адхамжонович'];
const P2 = ['ШАКИРОВА Шохида Юсуповна', 'МАХМУДОВ Достонбек Даврон ўғли'];
const P3 = ['ДАЛАЕВ Шухрат Ширматович', 'РИХСИЕВА Дилорам Хамидуллаевна', 'САЛИЖАНОВ Шерзод Садикжанович'];

function at(daysFromNow, hour, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d;
}

(async () => {
  console.log('BEFORE:', JSON.stringify({
    meetings: await prisma.meeting.count(),
    complaints: await prisma.complaint.count(),
    requests: await prisma.citizenRequest.count(),
  }));

  // 1) Meetings — wipe mock, insert 3 real Mirzo meetings.
  await prisma.meeting.deleteMany({});
  await prisma.meeting.createMany({
    data: [
      {
        id: 'YIG-M1', title: "Haftalik apparat yig'ilishi", type: 'apparat', status: 'scheduled',
        startAt: at(1, 9), durationMin: 90, location: 'Katta majlislar zali', chairDeputyId: CHAIR, chairName: CHAIR_NAME,
        agenda: ['Joriy masalalar', 'Murojaatlar tahlili', 'Topshiriqlar ijrosi'], participants: P1.length, participantNames: P1, districtId: DISTRICT,
      },
      {
        id: 'YIG-M2', title: 'Fuqarolar qabuli', type: 'qabul', status: 'scheduled',
        startAt: at(2, 14), durationMin: 120, location: 'Qabulxona', chairDeputyId: CHAIR, chairName: CHAIR_NAME,
        agenda: ['Shaxsiy qabul', 'Ariza va shikoyatlar'], participants: P2.length, participantNames: P2, districtId: DISTRICT,
      },
      {
        id: 'YIG-M3', title: 'Video selektor — viloyat hokimligi', type: 'video', status: 'done',
        startAt: at(-1, 10), durationMin: 60, location: 'https://murojaatnoma.uz/meet/selektor', chairDeputyId: CHAIR, chairName: CHAIR_NAME,
        agenda: ['Hisobot', 'Kelgusi vazifalar'], participants: P3.length, participantNames: P3, districtId: DISTRICT,
      },
    ],
  });

  // 2) Complaints — keep the 3 newest.
  const keepC = await prisma.complaint.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true } });
  const cDel = await prisma.complaint.deleteMany({ where: { id: { notIn: keepC.map((x) => x.id) } } });

  // 3) Requests — keep 3, pin to Mirzo so they show in the scoped view.
  const keepR = await prisma.citizenRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true } });
  const keepRIds = keepR.map((x) => x.id);
  const rDel = await prisma.citizenRequest.deleteMany({ where: { id: { notIn: keepRIds } } });
  await prisma.citizenRequest.updateMany({ where: { id: { in: keepRIds } }, data: { districtId: DISTRICT } });

  console.log('DELETED:', JSON.stringify({ complaints: cDel.count, requests: rDel.count, meetings: 'all-then-3' }));
  console.log('AFTER:', JSON.stringify({
    meetings: await prisma.meeting.count(),
    complaints: await prisma.complaint.count(),
    requests: await prisma.citizenRequest.count(),
  }));
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
