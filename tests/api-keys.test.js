/**
 * API Key 管理测试
 */

const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

describe('API Key 管理测试', () => {
  let authToken;
  const testEmail = `apikey_test_${Date.now()}@example.com`;
  // 使用数据库中已存在的测试用户
  const userId = 'f6d6d24b-ea0a-46d9-97fc-16f811fc8a4d';

  beforeAll(() => {
    authToken = generateToken({
      id: userId,
      email: testEmail
    });
  });

  describe('POST /api/keys', () => {
    test('应该创建新的 API Key', async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试 API Key',
          expiresDays: 30
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.apiKey).toBeDefined();
      expect(res.body.apiKey).toMatch(/^claw-calendar-/);
      expect(res.body.key).toBeDefined();
      expect(res.body.key.prefix).toBeDefined();
    });

    test('应该创建无过期时间的 API Key', async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '永久 API Key'
        });

      expect(res.status).toBe(201);
      expect(res.body.key.expiresAt).toBeNull();
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .post('/api/keys')
        .send({ name: '测试 Key' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/keys', () => {
    test('应该获取用户的所有 API Keys', async () => {
      const res = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.keys).toBeDefined();
      expect(Array.isArray(res.body.keys)).toBe(true);
    });

    test('应该拒绝无认证请求', async () => {
      const res = await request(app)
        .get('/api/keys');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/keys/:id', () => {
    let createdKeyId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '待更新 Key' });

      if (res.body.key) {
        createdKeyId = res.body.key.id;
      }
    });

    test('应该更新 API Key 名称', async () => {
      if (!createdKeyId) return;

      const res = await request(app)
        .put(`/api/keys/${createdKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新名称' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('应该禁用/启用 API Key', async () => {
      if (!createdKeyId) return;

      const res = await request(app)
        .put(`/api/keys/${createdKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.key.isActive).toBe(false);
    });

    test('应该拒绝不存在的 Key', async () => {
      const res = await request(app)
        .put('/api/keys/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '新名称' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/keys/:id', () => {
    let keyToDelete;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '待删除 Key' });

      if (res.body.key) {
        keyToDelete = res.body.key.id;
      }
    });

    test('应该删除 API Key', async () => {
      if (!keyToDelete) return;

      const res = await request(app)
        .delete(`/api/keys/${keyToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('应该拒绝删除不存在的 Key', async () => {
      const res = await request(app)
        .delete('/api/keys/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
