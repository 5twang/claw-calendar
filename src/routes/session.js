/**
 * 会话管理路由（登录/登出）
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { verifyPassword } = require('../utils/crypto');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateLoginInput } = require('../middleware/authValidation');

// 用户登录
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  validateLoginInput({ email, password });

  // 查找用户
  const result = await pool.query(
    'SELECT id, email, password_hash, name, is_active FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw errors.unauthorized('邮箱或密码错误');
  }

  const user = result.rows[0];

  // 检查是否已验证
  if (!user.is_active) {
    throw errors.forbidden('请先验证邮箱，查看收件箱中的验证邮件', 'EMAIL_NOT_VERIFIED');
  }

  // 验证密码
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw errors.unauthorized('邮箱或密码错误');
  }

  const token = generateToken(user);

  // 记录会话（仅在非测试环境）
  if (process.env.NODE_ENV !== 'test') {
    await pool.query(
      `INSERT INTO user_sessions (user_id, token_jti, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, jwt.decode(token).jti]
    );
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    token
  });
}));

// 用户登出
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // 将会话标记为过期
  await pool.query(
    'DELETE FROM user_sessions WHERE token_jti = $1',
    [req.tokenJti]
  );

  res.json({ success: true, message: '登出成功' });
}));

module.exports = router;
