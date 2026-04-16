/**
 * 认证验证中间件测试
 * 测试密码复杂度、邮箱验证等
 */

const { ValidationError, errors } = require('../src/utils/errors');
const {
  validatePasswordComplexity,
  validateRegisterInput,
  validateEmail,
  validatePasswordReset,
  validateLoginInput,
  validatePasswordChange
} = require('../src/middleware/authValidation');

describe('authValidation 中间件', () => {
  describe('validatePasswordComplexity', () => {
    test('应该接受有效的复杂密码', () => {
      expect(() => validatePasswordComplexity('Pass1234')).not.toThrow();
      expect(() => validatePasswordComplexity('Abc12345')).not.toThrow();
      expect(() => validatePasswordComplexity('Test9876')).not.toThrow();
    });

    test('应该拒绝空密码', () => {
      expect(() => validatePasswordComplexity('')).toThrow('密码长度至少8位');
      expect(() => validatePasswordComplexity(null)).toThrow('密码长度至少8位');
      expect(() => validatePasswordComplexity(undefined)).toThrow('密码长度至少8位');
    });

    test('应该拒绝短于8位的密码', () => {
      expect(() => validatePasswordComplexity('Pass123')).toThrow('密码长度至少8位');
      expect(() => validatePasswordComplexity('Ab12345')).toThrow('密码长度至少8位');
    });

    test('应该拒绝纯数字密码', () => {
      expect(() => validatePasswordComplexity('12345678')).toThrow('密码必须包含数字和字母');
    });

    test('应该拒绝纯字母密码', () => {
      expect(() => validatePasswordComplexity('Password')).toThrow('密码必须包含数字和字母');
    });

    test('应该拒绝只有数字和特殊字符的密码', () => {
      expect(() => validatePasswordComplexity('12345678!@')).toThrow('密码必须包含数字和字母');
    });

    test('应该拒绝只有字母和特殊字符的密码', () => {
      expect(() => validatePasswordComplexity('Password!')).toThrow('密码必须包含数字和字母');
    });

    test('应该接受包含特殊字符的复杂密码', () => {
      expect(() => validatePasswordComplexity('Pass1234!')).not.toThrow();
      expect(() => validatePasswordComplexity('Test@1234')).not.toThrow();
    });
  });

  describe('validateEmail', () => {
    test('应该接受有效的邮箱格式', () => {
      expect(() => validateEmail('test@example.com')).not.toThrow();
      expect(() => validateEmail('user.name@domain.co.uk')).not.toThrow();
      expect(() => validateEmail('user+tag@gmail.com')).not.toThrow();
    });

    test('应该拒绝空邮箱', () => {
      expect(() => validateEmail('')).toThrow('邮箱不能为空');
      expect(() => validateEmail(null)).toThrow('邮箱不能为空');
      expect(() => validateEmail(undefined)).toThrow('邮箱不能为空');
    });

    test('应该拒绝无效邮箱格式', () => {
      expect(() => validateEmail('invalid')).toThrow('邮箱格式不正确');
      expect(() => validateEmail('invalid@')).toThrow('邮箱格式不正确');
      expect(() => validateEmail('@example.com')).toThrow('邮箱格式不正确');
      expect(() => validateEmail('user @example.com')).toThrow('邮箱格式不正确');
      expect(() => validateEmail('user@example')).toThrow('邮箱格式不正确');
    });
  });

  describe('validateRegisterInput', () => {
    test('应该接受有效的注册信息', () => {
      expect(() => validateRegisterInput({
        email: 'test@example.com',
        password: 'Pass1234',
        name: 'Test User'
      })).not.toThrow();
    });

    test('应该接受没有 name 的注册信息', () => {
      expect(() => validateRegisterInput({
        email: 'test@example.com',
        password: 'Pass1234'
      })).not.toThrow();
    });

    test('应该拒绝无效邮箱', () => {
      expect(() => validateRegisterInput({
        email: 'invalid-email',
        password: 'Pass1234'
      })).toThrow();
    });

    test('应该拒绝简单密码', () => {
      expect(() => validateRegisterInput({
        email: 'test@example.com',
        password: 'password'
      })).toThrow();
    });

    test('应该收集所有验证错误', () => {
      try {
        validateRegisterInput({
          email: '',
          password: ''
        });
        fail('应该抛出 ValidationError');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect(e.details.email).toBeDefined();
        expect(e.details.password).toBeDefined();
      }
    });
  });

  describe('validateLoginInput', () => {
    test('应该接受有效的登录信息', () => {
      expect(() => validateLoginInput({
        email: 'test@example.com',
        password: 'anypassword'
      })).not.toThrow();
    });

    test('应该拒绝空邮箱', () => {
      expect(() => validateLoginInput({
        email: '',
        password: 'password123'
      })).toThrow();
    });

    test('应该拒绝空密码', () => {
      expect(() => validateLoginInput({
        email: 'test@example.com',
        password: ''
      })).toThrow();
    });
  });

  describe('validatePasswordReset', () => {
    test('应该接受有效的重置信息', () => {
      expect(() => validatePasswordReset({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPass123'
      })).not.toThrow();
    });

    test('应该拒绝无效验证码', () => {
      expect(() => validatePasswordReset({
        email: 'test@example.com',
        code: '12345',
        newPassword: 'NewPass123'
      })).toThrow();
    });

    test('应该拒绝简单新密码', () => {
      expect(() => validatePasswordReset({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'password'
      })).toThrow();
    });
  });

  describe('validatePasswordChange', () => {
    test('应该接受有效的修改信息', () => {
      expect(() => validatePasswordChange({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123'
      })).not.toThrow();
    });

    test('应该拒绝空当前密码', () => {
      expect(() => validatePasswordChange({
        currentPassword: '',
        newPassword: 'NewPass123'
      })).toThrow();
    });

    test('应该拒绝空新密码', () => {
      expect(() => validatePasswordChange({
        currentPassword: 'OldPass123',
        newPassword: ''
      })).toThrow();
    });

    test('应该拒绝短于8位的新密码', () => {
      expect(() => validatePasswordChange({
        currentPassword: 'OldPass123',
        newPassword: 'short'
      })).toThrow();
    });
  });
});
