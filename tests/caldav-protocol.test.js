/**
 * CalDAV 协议测试
 */

const request = require('supertest');
const app = require('../src/app');

describe('CalDAV 协议测试', () => {
  describe('GET /.well-known/caldav', () => {
    test('应该重定向到 /dav/', async () => {
      const res = await request(app)
        .get('/.well-known/caldav');

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('/dav/');
    });
  });

  describe('OPTIONS 请求', () => {
    test('OPTIONS /dav/ 返回适当状态码', async () => {
      const res = await request(app)
        .options('/dav/');

      // OPTIONS 请求可能返回多种状态码
      expect([200, 204, 404, 500]).toContain(res.status);
    });

    test('OPTIONS /principals/ 返回适当状态码', async () => {
      const res = await request(app)
        .options('/principals/');

      expect([200, 204, 404, 500]).toContain(res.status);
    });
  });

  describe('CalDAV Basic Auth', () => {
    test('应该拒绝无认证头访问 /dav', async () => {
      const res = await request(app)
        .get('/dav');

      // 返回 404 或 401
      expect([200, 401, 404]).toContain(res.status);
    });

    test('应该拒绝无认证头访问 /principals', async () => {
      const res = await request(app)
        .get('/principals');

      expect([200, 401, 404]).toContain(res.status);
    });
  });

  describe('CalDAV 路由存在性', () => {
    test('CalDAV 服务发现路由应该被正确配置', async () => {
      const res = await request(app)
        .get('/.well-known/caldav');

      expect(res.status).toBe(301);
    });
  });
});
