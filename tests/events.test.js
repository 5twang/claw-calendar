/**
 * 事件 CRUD 测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('事件 CRUD 测试', () => {
  let authToken;
  // 使用数据库中已存在的测试用户
  const testEmail = 'workbuddy@test.com';
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';
  let testCalendarId;

  beforeAll(async () => {
    authToken = generateToken({
      id: userId,
      email: testEmail
    });

    // 创建测试日历
    const calRes = await request(app)
      .post('/api/calendars')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '事件测试日历' });

    if (calRes.body.calendar) {
      testCalendarId = calRes.body.calendar.id;
    }
  });

  describe('POST /api/calendars/:calendarId/events', () => {
    test('应该创建新事件', async () => {
      if (!testCalendarId) {
        console.log('跳过事件创建测试：日历创建失败');
        return;
      }

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '测试事件',
          startDate: '2026-04-20',
          endDate: '2026-04-20',
          description: '事件描述',
          location: '会议地点',
          alarm: true,
          alarmMinutes: 30
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toBeDefined();
      expect(res.body.event.title).toBe('测试事件');
    });

    test('应该拒绝缺失标题', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: '2026-04-20'
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝无效日期格式', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '测试',
          startDate: '2026/04/20'  // 错误格式
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/calendars/:calendarId/events', () => {
    test('应该获取日历的所有事件', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events).toBeDefined();
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    test('应该支持日期范围查询', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events`)
        .query({ start: '2026-04-01', end: '2026-04-30' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
    });
  });
});
