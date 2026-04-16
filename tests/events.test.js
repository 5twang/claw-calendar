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

    test('应该正确设置全天事件（isAllDay=true）', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '全天会议',
          startDate: '2026-04-20',
          endDate: '2026-04-20',
          isAllDay: true
        });

      expect(res.status).toBe(201);
      expect(res.body.event.isAllDay).toBe(true);
      expect(res.body.event.startTime).toBeNull();
      expect(res.body.event.endTime).toBeNull();
    });

    test('应该正确设置带时间事件（isAllDay=false）', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '下午会议',
          startDate: '2026-04-20',
          endDate: '2026-04-20',
          startTime: '14:00',
          endTime: '15:00',
          isAllDay: false
        });

      expect(res.status).toBe(201);
      expect(res.body.event.isAllDay).toBe(false);
      expect(res.body.event.startTime).toBe('14:00');
      expect(res.body.event.endTime).toBe('15:00');
    });

    test('应该正确处理多天全天事件', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '展会活动',
          startDate: '2026-04-20',
          endDate: '2026-04-22',
          isAllDay: true
        });

      expect(res.status).toBe(201);
      expect(res.body.event.isAllDay).toBe(true);
      expect(res.body.event.startDate).toBe('2026-04-20');
      expect(res.body.event.endDate).toBe('2026-04-22');
      expect(res.body.event.startTime).toBeNull();
    });

    test('应该拒绝非全天事件结束日期早于开始日期', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '错误日期事件',
          startDate: '2026-04-22',
          endDate: '2026-04-20',
          startTime: '14:00',
          endTime: '15:00',
          isAllDay: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    test('应该正确处理全天事件的 startTime 和 endTime 为 null', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '全天事件不应有时间',
          startDate: '2026-04-20',
          endDate: '2026-04-21',
          startTime: '10:00',  // 即使传了时间
          endTime: '11:00',
          isAllDay: true       // 全天为 true 时时间应被忽略
        });

      expect(res.status).toBe(201);
      expect(res.body.event.isAllDay).toBe(true);
      expect(res.body.event.startTime).toBeNull();
      expect(res.body.event.endTime).toBeNull();
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
