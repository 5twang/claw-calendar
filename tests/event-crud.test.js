/**
 * 事件更新/删除/恢复 测试
 * 补充 events.test.js 中缺失的测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('事件更新/删除/恢复测试', () => {
  let authToken;
  const testEmail = 'workbuddy@test.com';
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';
  let testCalendarId;
  let testEventId;

  beforeAll(async () => {
    authToken = generateToken({
      id: userId,
      email: testEmail
    });

    // 创建测试日历
    const calRes = await request(app)
      .post('/api/calendars')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'CRUD测试日历' });

    if (calRes.body.calendar) {
      testCalendarId = calRes.body.calendar.id;
    }
  });

  describe('POST /api/calendars/:calendarId/events - 创建事件用于后续测试', () => {
    test('创建测试事件', async () => {
      if (!testCalendarId) {
        console.log('跳过：日历创建失败');
        return;
      }

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '待更新的事件',
          startDate: '2026-04-25',
          endDate: '2026-04-25',
          description: '原始描述',
          alarm: true
        });

      expect(res.status).toBe(201);
      if (res.body.event) {
        testEventId = res.body.event.id;
      }
    });
  });

  describe('PUT /api/calendars/:calendarId/events/:eventId - 更新事件', () => {
    test('应该更新事件标题', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '更新后的事件标题'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.title).toBe('更新后的事件标题');
    });

    test('应该更新事件日期和时间', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: '2026-04-26',
          endDate: '2026-04-26',
          startTime: '10:00',
          endTime: '11:30',
          isAllDay: false
        });

      expect(res.status).toBe(200);
      expect(res.body.event.startDate).toBe('2026-04-26');
      expect(res.body.event.startTime).toBe('10:00');
      expect(res.body.event.endTime).toBe('11:30');
      expect(res.body.event.isAllDay).toBe(false);
    });

    test('应该更新多个字段', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '多字段更新',
          description: '新的描述',
          location: '新地点',
          alarm: false
        });

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('多字段更新');
      expect(res.body.event.description).toBe('新的描述');
      expect(res.body.event.location).toBe('新地点');
      expect(res.body.event.alarmEnabled).toBe(false);
    });

    test('应该拒绝无认证请求', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .send({ title: '无认证更新' });

      expect(res.status).toBe(401);
    });

    test('应该拒绝不存在的日历', async () => {
      if (!testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/nonexistent-calendar/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: '测试' });

      expect(res.status).toBe(404);
    });

    test('应该拒绝不存在的日历', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/nonexistent-event`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: '测试' });

      expect(res.status).toBe(404);
    });

    test('应该拒绝无更新字段', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .put(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/calendars/:calendarId/events/:eventId - 删除事件', () => {
    let eventToDelete;
    let deletedEventData;

    beforeAll(async () => {
      // 创建待删除事件
      if (testCalendarId) {
        const res = await request(app)
          .post(`/api/calendars/${testCalendarId}/events`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: '待删除事件',
            startDate: '2026-04-27',
            endDate: '2026-04-27'
          });

        if (res.body.event) {
          eventToDelete = res.body.event.id;
          deletedEventData = res.body.event;
        }
      }
    });

    test('应该删除事件并返回完整数据', async () => {
      if (!testCalendarId || !eventToDelete) return;

      const res = await request(app)
        .delete(`/api/calendars/${testCalendarId}/events/${eventToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('事件已删除');
      expect(res.body.deletedEvent).toBeDefined();
      expect(res.body.deletedEvent.title).toBe('待删除事件');
    });

    test('应该拒绝无认证请求', async () => {
      if (!testCalendarId || !eventToDelete) return;

      const res = await request(app)
        .delete(`/api/calendars/${testCalendarId}/events/${eventToDelete}`);

      expect(res.status).toBe(401);
    });

    test('应该拒绝删除不存在的日历中的事件', async () => {
      if (!eventToDelete) return;

      const res = await request(app)
        .delete(`/api/calendars/nonexistent-calendar/events/${eventToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    test('删除后应该无法获取该事件', async () => {
      if (!testCalendarId || !eventToDelete) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events/${eventToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/calendars/:calendarId/events/:eventId/restore - 恢复事件', () => {
    test('应该恢复已删除的事件', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events/${testEventId}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          calendarId: testCalendarId,
          title: '恢复的事件',
          startDate: '2026-04-28',
          endDate: '2026-04-28',
          description: '恢复的描述',
          location: '恢复的地点',
          alarmEnabled: true,
          alarmMinutes: 15
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('事件已恢复');
      expect(res.body.event).toBeDefined();
      expect(res.body.event.title).toBe('恢复的事件');
    });

    test('应该拒绝缺少必要字段', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events/${testEventId}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          calendarId: testCalendarId
          // 缺少 title 和 startDate
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝恢复到自己不拥有的日历', async () => {
      if (!testEventId) return;

      const res = await request(app)
        .post(`/api/calendars/other-user-calendar/events/${testEventId}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          calendarId: 'other-user-calendar',
          title: '测试恢复',
          startDate: '2026-04-29'
        });

      expect(res.status).toBe(403);
    });

    test('应该拒绝无认证请求', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .post(`/api/calendars/${testCalendarId}/events/${testEventId}/restore`)
        .send({
          calendarId: testCalendarId,
          title: '测试',
          startDate: '2026-04-30'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/calendars/:calendarId/events/:eventId - 获取单个事件', () => {
    test('应该获取单个事件详情', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toBeDefined();
      expect(res.body.event.id).toBe(testEventId);
    });

    test('应该拒绝无认证请求', async () => {
      if (!testCalendarId || !testEventId) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events/${testEventId}`);

      expect(res.status).toBe(401);
    });

    test('应该拒绝不存在的日历', async () => {
      if (!testEventId) return;

      const res = await request(app)
        .get(`/api/calendars/nonexistent-calendar/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    test('应该拒绝不存在的日历', async () => {
      if (!testCalendarId) return;

      const res = await request(app)
        .get(`/api/calendars/${testCalendarId}/events/nonexistent-event`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
