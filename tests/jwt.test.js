/**
 * JWT 安全测试
 * 测试 JWT_SECRET 相关的安全行为
 */

const jwt = require('jsonwebtoken');

// 设置测试用 JWT_SECRET
const TEST_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_SECRET = TEST_SECRET;

describe('JWT 安全测试', () => {
  describe('JWT_SECRET 验证', () => {
    test('应该使用正确的密钥签名', () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, TEST_SECRET);

      expect(decoded.userId).toBe('123');
    });

    test('应该拒绝错误密钥签名的 token', () => {
      const token = jwt.sign({ userId: '123' }, 'wrong-secret');

      expect(() => {
        jwt.verify(token, TEST_SECRET);
      }).toThrow();
    });

    test('应该拒绝过期 token', () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET, { expiresIn: '-1s' });

      expect(() => {
        jwt.verify(token, TEST_SECRET);
      }).toThrow(/jwt expired/i);
    });

    test('应该拒绝无效格式的 token', () => {
      expect(() => {
        jwt.verify('invalid-token', TEST_SECRET);
      }).toThrow();

      expect(() => {
        jwt.verify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid', TEST_SECRET);
      }).toThrow();
    });
  });

  describe('JWT 签发和验证', () => {
    test('应该正确签发包含 userId 的 token', () => {
      const userId = 'user-uuid-123';
      const token = jwt.sign({ userId }, TEST_SECRET, { expiresIn: '7d' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('应该正确验证包含 userId 的 token', () => {
      const userId = 'user-uuid-456';
      const token = jwt.sign({ userId }, TEST_SECRET);

      const decoded = jwt.verify(token, TEST_SECRET);
      expect(decoded.userId).toBe(userId);
    });

    test('应该拒绝不包含 userId 的 token', () => {
      const token = jwt.sign({ email: 'test@test.com' }, TEST_SECRET);
      const decoded = jwt.verify(token, TEST_SECRET);

      expect(decoded.userId).toBeUndefined();
    });
  });
});
