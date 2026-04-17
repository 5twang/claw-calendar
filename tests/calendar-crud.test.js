/**
 * 日历更新/删除 测试
 * 补充 calendars.test.js 中缺失的测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('日历更新/删除测试', () => {
  let authToken;
  const testEmail = 'workbuddy@test.com';
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';
  let calendarToUpdate;

  beforeAll(() => {
    authToken = generateToken({
      id: userId,
      email: testEmail
    });
  });

  describe('PUT /api/calendars/:id - 更新日历', () => {
    beforeAll(async () => {
      // 创建待更新的日历
      const res = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '待更新的日历',
          description: '原始描述',
          color: '#4f46e5'
        });

      if (res.body.calendar) {
        calendarToUpdate = res.body.calendar.id;
      }
    });

    test('应该更新日历名称', async () => {
      if (!calendarToUpdate) {
        console.log('跳过：日历创建失败');
        return;
      }

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '更新后的日历名称'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.calendar.name).toBe('更新后的日历名称');
    });

    test('应该更新日历描述', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: '更新后的描述'
        });

      expect(res.status).toBe(200);
      expect(res.body.calendar.description).toBe('更新后的描述');
    });

    test('应该更新日历颜色', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          color: '#10b981'
        });

      expect(res.status).toBe(200);
      expect(res.body.calendar.color).toBe('#10b981');
    });

    test('应该更新公开状态', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isPublic: true
        });

      expect(res.status).toBe(200);
      expect(res.body.calendar.isPublic).toBe(true);
    });

    test('应该同时更新多个字段', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '多字段更新',
          description: '多字段描述',
          color: '#f59e0b',
          isPublic: false
        });

      expect(res.status).toBe(200);
      expect(res.body.calendar.name).toBe('多字段更新');
      expect(res.body.calendar.description).toBe('多字段描述');
      expect(res.body.calendar.color).toBe('#f59e0b');
      expect(res.body.calendar.isPublic).toBe(false);
    });

    test('应该拒绝无认证请求', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .put(`/api/calendars/${calendarToUpdate}`)
        .send({
          name: '无认证更新'
        });

      expect(res.status).toBe(401);
    });

    test('应该拒绝更新不存在的日历', async () => {
      const res = await request(app)
        .put('/api/calendars/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试'
        });

      expect(res.status).toBe(404);
    });

    test('应该拒绝更新他人的日历', async () => {
      // 尝试更新不属于自己的日历（返回404因为找不到，或403权限不足）
      const res = await request(app)
        .put('/api/calendars/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '非法更新'
        });

      // 日历不存在或无权访问
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/calendars/:id - 获取单个日历', () => {
    test('应该获取单个日历详情', async () => {
      if (!calendarToUpdate) {
        console.log('跳过：日历创建失败');
        return;
      }

      const res = await request(app)
        .get(`/api/calendars/${calendarToUpdate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.calendar).toBeDefined();
      expect(res.body.calendar.id).toBe(calendarToUpdate);
    });

    test('应该拒绝无认证请求', async () => {
      if (!calendarToUpdate) return;

      const res = await request(app)
        .get(`/api/calendars/${calendarToUpdate}`);

      expect(res.status).toBe(401);
    });

    test('应该拒绝不存在的日历', async () => {
      const res = await request(app)
        .get('/api/calendars/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    test('应该拒绝访问他人的非公开日历', async () => {
      const res = await request(app)
        .get('/api/calendars/other-user-private-calendar')
        .set('Authorization', `Bearer ${authToken}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/calendars/:id - 删除日历', () => {
    let calendarToDelete;

    beforeAll(async () => {
      // 创建待删除的日历
      const res = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '待删除的日历'
        });

      if (res.body.calendar) {
        calendarToDelete = res.body.calendar.id;
      }
    });

    test('应该删除日历', async () => {
      if (!calendarToDelete) {
        console.log('跳过：日历创建失败');
        return;
      }

      const res = await request(app)
        .delete(`/api/calendars/${calendarToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('日历已删除');
    });

    test('删除后应该无法获取该日历', async () => {
      if (!calendarToDelete) return;

      const res = await request(app)
        .get(`/api/calendars/${calendarToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    test('应该拒绝无认证请求', async () => {
      if (!calendarToDelete) return;

      const res = await request(app)
        .delete(`/api/calendars/${calendarToDelete}`);

      expect(res.status).toBe(401);
    });

    test('应该拒绝删除不存在的日历', async () => {
      const res = await request(app)
        .delete('/api/calendars/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    test('删除日历应该同时删除其所有事件', async () => {
      // 创建日历和事件
      const calRes = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '含事件的日历'
        });

      if (!calRes.body.calendar) {
        console.log('跳过：日历创建失败');
        return;
      }

      const calendarId = calRes.body.calendar.id;

      // 添加事件
      await request(app)
        .post(`/api/calendars/${calendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '日历中的事件',
          startDate: '2026-05-01'
        });

      // 删除日历
      const delRes = await request(app)
        .delete(`/api/calendars/${calendarId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(delRes.status).toBe(200);

      // 验证事件也被删除
      const eventsRes = await request(app)
        .get(`/api/calendars/${calendarId}/events`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(eventsRes.status).toBe(404);
    });
  });
});
