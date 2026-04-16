/**
 * 用户信息管理测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('用户信息测试', () => {
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

  describe('GET /api/user/me', () => {
    test('应该获取当前用户信息', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .get('/api/user/me');

      expect(res.status).toBe(401);
    });

    test('应该拒绝无效 Token', async () => {
      const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/user/me', () => {
    test('应该更新用户名', async () => {
      const res = await request(app)
        .put('/api/user/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新用户名' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('新用户名');
    });

    test('应该允许设置空名称', async () => {
      const res = await request(app)
        .put('/api/user/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(res.status).toBe(200);
    });

    test('应该拒绝超长名称', async () => {
      const res = await request(app)
        .put('/api/user/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(101) });

      expect(res.status).toBe(400);
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .put('/api/user/me')
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/user/password', () => {
    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .send({
          currentPassword: 'OldPass123',
          newPassword: 'NewPass123'
        });

      expect(res.status).toBe(401);
    });

    test('应该拒绝空密码', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: '',
          newPassword: 'NewPass123'
        });

      expect(res.status).toBe(400);
    });

    test('应该拒绝过短的新密码', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'OldPass123',
          newPassword: 'short'
        });

      expect(res.status).toBe(400);
    });
  });
});
