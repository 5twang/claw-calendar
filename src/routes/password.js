/**
 * 密码重置路由
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hashPassword } = require('../utils/crypto');
const { generateVerificationCode, sendVerificationEmail } = require('../utils/email');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateEmail, validatePasswordReset } = require('../middleware/authValidation');

// 请求重置密码
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  validateEmail(email);

  // 查找用户
  const userResult = await pool.query(
    'SELECT id, email FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  // 为了安全，即使用户不存在也返回成功消息
  if (userResult.rows.length === 0) {
    return res.json({
      success: true,
      message: '如果该邮箱已注册，重置邮件已发送'
    });
  }

  const user = userResult.rows[0];

  // 删除旧的重置记录
  await pool.query(
    `DELETE FROM email_verifications
     WHERE user_id = $1 AND type = 'reset' AND used = false`,
    [user.id]
  );

  // 生成6位验证码
  const resetCode = generateVerificationCode();

  // 保存重置记录（10分钟有效期）
  await pool.query(
    `INSERT INTO email_verifications (user_id, email, token, type, expires_at)
     VALUES ($1, $2, $3, 'reset', NOW() + INTERVAL '10 minutes')`,
    [user.id, user.email, resetCode]
  );

  // 发送重置邮件
  const emailSent = await sendVerificationEmail(user.email, resetCode, 'reset');
  if (!emailSent) {
    throw errors.serverError('邮件发送失败，请稍后重试');
  }

  res.json({
    success: true,
    message: '验证码已发送到您的邮箱，有效期为10分钟',
    email: email
  });
}));

// 重置密码（支持两种方式：email+code 或 token）
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, code, newPassword, token } = req.body;

  let userId;

  // 方式1：使用 email + code 验证
  if (email && code) {
    // 只验证 email 和 code，newPassword 验证放后面
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw errors.badRequest('邮箱格式不正确');
    }
    if (!code || code.length !== 6) {
      throw errors.badRequest('验证码格式不正确（6位数字）');
    }

    const result = await pool.query(
      `SELECT ev.*, u.id as user_id FROM email_verifications ev
       JOIN users u ON ev.user_id = u.id
       WHERE u.email = $1 AND ev.token = $2 AND ev.type = 'reset'
         AND ev.used = false AND ev.expires_at > NOW()`,
      [email.toLowerCase(), code]
    );

    if (result.rows.length === 0) {
      throw errors.badRequest('验证码无效或已过期', 'RESET_CODE_INVALID');
    }

    userId = result.rows[0].user_id;

    // 标记验证记录为已使用
    await pool.query(
      'UPDATE email_verifications SET used = true WHERE id = $1',
      [result.rows[0].id]
    );
  }
  // 方式2：使用 token（JWT 方式）
  else if (token) {
    try {
      // 解码 token 获取用户 ID
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'claw-calendar-secret');
      userId = decoded.userId;
    } catch (err) {
      throw errors.badRequest('重置链接无效或已过期');
    }
  }
  else {
    throw errors.badRequest('请提供验证码或重置链接');
  }

  // 验证新密码
  if (!newPassword || newPassword.length < 8) {
    throw errors.badRequest('密码长度至少8位');
  }

  // 哈希新密码
  const newPasswordHash = await hashPassword(newPassword);

  // 更新密码
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPasswordHash, userId]
  );

  // 使所有会话失效
  await pool.query(
    'DELETE FROM user_sessions WHERE user_id = $1',
    [userId]
  );

  res.json({
    success: true,
    message: '密码重置成功，请使用新密码登录'
  });
}));

// ============== 注册验证码流程 ==============

// 发送注册验证码
router.post('/send-register-code', asyncHandler(async (req, res) => {
  const { email } = req.body;

  validateEmail(email);

  // 检查邮箱是否已存在
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw errors.conflict('该邮箱已被注册');
  }

  // 删除旧的注册验证码记录
  await pool.query(
    `DELETE FROM email_verifications
     WHERE email = $1 AND type = 'register' AND used = false`,
    [email.toLowerCase()]
  );

  // 生成6位验证码
  const registerCode = generateVerificationCode();

  // 保存注册验证码（10分钟有效期）
  await pool.query(
    `INSERT INTO email_verifications (email, token, type, expires_at)
     VALUES ($1, $2, 'register', NOW() + INTERVAL '10 minutes')`,
    [email.toLowerCase(), registerCode]
  );

  // 发送验证码邮件
  const emailSent = await sendVerificationEmail(email.toLowerCase(), registerCode, 'register');
  if (!emailSent) {
    throw errors.serverError('邮件发送失败，请稍后重试');
  }

  res.json({
    success: true,
    message: '验证码已发送到您的邮箱，有效期为10分钟'
  });
}));

// 验证注册验证码（不注册，仅验证）
router.post('/verify-register-code', asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw errors.badRequest('请填写所有必填项');
  }

  // 查找验证码记录
  const result = await pool.query(
    `SELECT * FROM email_verifications
     WHERE email = $1 AND token = $2 AND type = 'register'
       AND used = false AND expires_at > NOW()`,
    [email.toLowerCase(), code]
  );

  if (result.rows.length === 0) {
    throw errors.badRequest('验证码无效或已过期', 'REGISTER_CODE_INVALID');
  }

  res.json({ success: true });
}));

// 验证注册验证码并完成注册
router.post('/register-with-code', asyncHandler(async (req, res) => {
  const { email, code, password, name } = req.body;

  // 验证输入
  if (!email || !code || !password) {
    throw errors.badRequest('请填写所有必填项');
  }
  if (password.length < 8) {
    throw errors.badRequest('密码长度至少8位');
  }

  // 查找验证码记录
  const result = await pool.query(
    `SELECT * FROM email_verifications
     WHERE email = $1 AND token = $2 AND type = 'register'
       AND used = false AND expires_at > NOW()`,
    [email.toLowerCase(), code]
  );

  if (result.rows.length === 0) {
    throw errors.badRequest('验证码无效或已过期', 'REGISTER_CODE_INVALID');
  }

  const verification = result.rows[0];

  // 哈希密码
  const passwordHash = await hashPassword(password);

  // 创建用户（已激活，因为已通过邮箱验证）
  const userResult = await pool.query(
    `INSERT INTO users (email, password_hash, name, is_active)
     VALUES ($1, $2, $3, true) RETURNING id, email, name, created_at`,
    [email.toLowerCase(), passwordHash, name || null]
  );

  const user = userResult.rows[0];

  // 标记验证码为已使用
  await pool.query(
    'UPDATE email_verifications SET used = true WHERE id = $1',
    [verification.id]
  );

  res.status(201).json({
    success: true,
    message: '注册成功！',
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
}));

module.exports = router;
