/**
 * 邮箱验证路由
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateVerificationToken, sendVerificationEmail } = require('../utils/email');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');

// 验证邮箱
router.get('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw errors.badRequest('缺少验证令牌');
  }

  // 查找验证记录
  const result = await pool.query(
    `SELECT * FROM email_verifications
     WHERE token = $1 AND type = 'verify' AND used = false AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    throw errors.badRequest('验证链接无效或已过期', 'VERIFICATION_INVALID');
  }

  const verification = result.rows[0];

  // 激活用户
  await pool.query(
    'UPDATE users SET is_active = true WHERE id = $1',
    [verification.user_id]
  );

  // 标记验证记录为已使用
  await pool.query(
    'UPDATE email_verifications SET used = true WHERE id = $1',
    [verification.id]
  );

  res.json({ success: true, message: '邮箱验证成功' });
}));

// 重新发送验证邮件
router.post('/resend-verify', authenticateToken, asyncHandler(async (req, res) => {
  // 获取用户信息
  const userResult = await pool.query(
    'SELECT id, email, is_active FROM users WHERE id = $1',
    [req.userId]
  );

  if (userResult.rows.length === 0) {
    throw errors.notFound('用户不存在');
  }

  const user = userResult.rows[0];

  // 如果已激活，无需验证
  if (user.is_active) {
    throw errors.badRequest('账户已激活，无需验证', 'ALREADY_VERIFIED');
  }

  // 删除旧的验证记录
  await pool.query(
    `DELETE FROM email_verifications
     WHERE user_id = $1 AND type = 'verify' AND used = false`,
    [user.id]
  );

  // 生成新令牌
  const newToken = generateVerificationToken();

  // 保存新验证记录
  await pool.query(
    `INSERT INTO email_verifications (user_id, email, token, type, expires_at)
     VALUES ($1, $2, $3, 'verify', NOW() + INTERVAL '24 hours')`,
    [user.id, user.email, newToken]
  );

  // 发送验证邮件
  const emailSent = await sendVerificationEmail(user.email, newToken, 'verify');
  if (!emailSent) {
    throw errors.serverError('验证邮件发送失败，请稍后重试');
  }

  res.json({ success: true, message: '验证邮件已发送，请查收' });
}));

module.exports = router;
