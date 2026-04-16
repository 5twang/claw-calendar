/**
 * 日历 CRUD 测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('日历 CRUD 测试', () => {
  let authToken;
  // 使用数据库中已存在的测试用户
  const testEmail = 'workbuddy@test.com';
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';

  beforeAll(() => {
    authToken = generateToken({
      id: userId,
      email: testEmail
    });
  });

  describe('POST /api/calendars', () => {
    test('应该创建新日历', async () => {
      const res = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '我的日历',
          description: '测试日历描述',
          color: '#ff5722',
          isPublic: false
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.calendar).toBeDefined();
      expect(res.body.calendar.name).toBe('我的日历');
      expect(res.body.calendar.color).toBe('#ff5722');
      expect(res.body.calendar.subscribeToken).toBeDefined();
    });

    test('应该拒绝空名称', async () => {
      const res = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: ''
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝无效颜色格式', async () => {
      const res = await request(app)
        .post('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试日历',
          color: 'red'  // 无效格式，应该使用默认值
        });

      expect(res.status).toBe(201);
      expect(res.body.calendar.color).toBe('#4f46e5');  // 默认紫色
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .post('/api/calendars')
        .send({ name: '测试日历' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/calendars', () => {
    test('应该获取用户的所有日历', async () => {
      const res = await request(app)
        .get('/api/calendars')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.calendars).toBeDefined();
      expect(Array.isArray(res.body.calendars)).toBe(true);
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .get('/api/calendars');

      expect(res.status).toBe(401);
    });
  });
});
