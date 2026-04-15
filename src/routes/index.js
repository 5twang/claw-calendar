/**
 * 认证路由汇总
 * 
 * 将 auth.js 拆分为以下模块：
 * - registration: POST /register
 * - session: POST /login, POST /logout
 * - user: GET /me, PUT /password
 * - verification: GET /verify-email, POST /resend-verify
 * - password: POST /forgot-password, POST /reset-password
 */

const express = require('express');
const router = express.Router();

// 导入子路由
const registrationRouter = require('./registration');
const sessionRouter = require('./session');
const userRouter = require('./user');
const verificationRouter = require('./verification');
const passwordRouter = require('./password');

// 挂载子路由
router.use('/', registrationRouter);      // POST /register
router.use('/', sessionRouter);            // POST /auth/login, POST /auth/logout
router.use('/', userRouter);               // GET /auth/me, PUT /auth/password
router.use('/', verificationRouter);       // GET /auth/verify-email, POST /auth/resend-verify
router.use('/', passwordRouter);            // POST /auth/forgot-password, POST /auth/reset-password

// 临时激活用户端点（开发用）
const { asyncHandler, errors } = require('../middleware/errorHandler');
const pool = require('../config/database');

router.post('/activate-user', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw errors.badRequest('缺少邮箱');
  }

  const result = await pool.query(
    'UPDATE users SET is_active = true WHERE email = $1',
    [email.toLowerCase()]
  );

  res.json({ success: true, rowCount: result.rowCount });
}));

module.exports = router;
