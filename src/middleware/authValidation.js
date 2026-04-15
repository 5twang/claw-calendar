/**
 * 认证相关验证中间件
 * 提取自 auth.js 的验证函数，便于复用
 */

const { ValidationError, errors } = require('../utils/errors');

/**
 * 验证注册输入
 */
function validateRegisterInput({ email, password, name }) {
  const validationErrors = {};

  if (!email) {
    validationErrors.email = '邮箱不能为空';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    validationErrors.email = '邮箱格式不正确';
  }

  if (!password) {
    validationErrors.password = '密码不能为空';
  } else if (password.length < 8) {
    validationErrors.password = '密码长度至少8位';
  }

  if (Object.keys(validationErrors).length > 0) {
    throw new ValidationError(validationErrors);
  }
}

/**
 * 验证邮箱格式
 */
function validateEmail(email) {
  if (!email) {
    throw errors.badRequest('邮箱不能为空');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errors.badRequest('邮箱格式不正确');
  }
}

/**
 * 验证密码重置输入
 */
function validatePasswordReset({ email, code, newPassword }) {
  const validationErrors = {};

  if (!email) validationErrors.email = '邮箱不能为空';
  if (!code) validationErrors.code = '验证码不能为空';
  else if (code.length !== 6) validationErrors.code = '验证码格式不正确（6位数字）';
  if (!newPassword) validationErrors.newPassword = '新密码不能为空';
  else if (newPassword.length < 8) validationErrors.newPassword = '密码长度至少8位';

  if (Object.keys(validationErrors).length > 0) {
    throw new ValidationError(validationErrors);
  }
}

/**
 * 验证登录输入
 */
function validateLoginInput({ email, password }) {
  if (!email || !password) {
    throw errors.badRequest('邮箱和密码不能为空');
  }
}

/**
 * 验证修改密码输入
 */
function validatePasswordChange({ currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw errors.badRequest('当前密码和新密码不能为空');
  }

  if (newPassword.length < 8) {
    throw errors.badRequest('新密码长度至少8位');
  }
}

module.exports = {
  validateRegisterInput,
  validateEmail,
  validatePasswordReset,
  validateLoginInput,
  validatePasswordChange
};
