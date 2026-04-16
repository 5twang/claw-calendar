/**
 * 用户信息路由（/me, /password）
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const { authenticateToken } = require('../middleware/auth');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const { validatePasswordChange } = require('../middleware/authValidation');
const { formatDateTime } = require('../utils/constants');

// 获取当前用户信息
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  // 使用一次查询获取用户信息和日历数量
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.created_at,
            COUNT(c.id) as calendar_count
     FROM users u
     LEFT JOIN calendars c ON u.id = c.user_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [req.userId]
  );

  if (result.rows.length === 0) {
    throw errors.notFound('用户不存在');
  }

  const user = result.rows[0];

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: formatDateTime(user.created_at),
      calendarCount: parseInt(user.calendar_count)
    }
  });
}));

// 修改密码
router.put('/password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  validatePasswordChange({ currentPassword, newPassword });

  // 获取当前密码哈希
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    throw errors.notFound('用户不存在');
  }

  // 验证当前密码
  const isValid = await verifyPassword(currentPassword, result.rows[0].password_hash);
  if (!isValid) {
    throw errors.unauthorized('当前密码错误');
  }

  // 更新密码
  const newHash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, req.userId]
  );

  // 使所有会话失效
  await pool.query(
    'DELETE FROM user_sessions WHERE user_id = $1',
    [req.userId]
  );

  res.json({ success: true, message: '密码修改成功，请重新登录' });
}));

// 更新当前用户信息（仅姓名）
router.put('/me', authenticateToken, asyncHandler(async (req, res) => {
  const { name } = req.body;

  // 姓名可以是空字符串，但如果有内容则限制长度
  if (name && name.length > 100) {
    throw errors.badRequest('姓名长度不能超过100个字符');
  }

  await pool.query(
    'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2',
    [name || null, req.userId]
  );

  // 获取更新后的用户信息
  const result = await pool.query(
    'SELECT id, email, name, created_at FROM users WHERE id = $1',
    [req.userId]
  );

  const user = result.rows[0];

  res.json({
    success: true,
    message: '姓名更新成功',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: formatDateTime(user.created_at)
    }
  });
}));

module.exports = router;
