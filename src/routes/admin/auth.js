/**
 * Admin 登录路由
 * 
 * POST /api/admin/auth/login
 * - 验证邮箱密码（复用现有登录逻辑）
 * - 检查用户是否有 is_admin=true
 * - 返回 JWT token + 用户信息
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const { verifyPassword } = require('../../utils/crypto');
const { generateToken } = require('../../middleware/auth');
const { errors } = require('../../utils/errors');
const { asyncHandler } = require('../../middleware/errorHandler');

// 管理员登录
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw errors.badRequest('请提供邮箱和密码');
  }

  // 查找用户
  const result = await pool.query(
    'SELECT id, email, password_hash, name, is_active, is_admin FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw errors.unauthorized('邮箱或密码错误');
  }

  const user = result.rows[0];

  // 检查是否激活
  if (!user.is_active) {
    throw errors.forbidden('账户已被禁用', 'ACCOUNT_DISABLED');
  }

  // 检查是否为管理员
  if (!user.is_admin) {
    throw errors.forbidden('非管理员账户无法登录管理面板', 'ADMIN_REQUIRED');
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
      name: user.name,
      is_admin: user.is_admin
    },
    token
  });
}));

module.exports = router;
