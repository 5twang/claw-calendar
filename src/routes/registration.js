/**
 * 用户注册路由
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hashPassword } = require('../utils/crypto');
const { generateVerificationToken, sendVerificationEmail } = require('../utils/email');
const { errors } = require('../utils/errors');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRegisterInput } = require('../middleware/authValidation');

// 用户注册
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // 验证输入
  validateRegisterInput({ email, password, name });

  // 检查邮箱是否已存在
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw errors.conflict('该邮箱已被注册');
  }

  // 哈希密码
  const passwordHash = await hashPassword(password);

  // 创建用户（默认未激活）
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name, is_active)
     VALUES ($1, $2, $3, false) RETURNING id, email, name, created_at`,
    [email.toLowerCase(), passwordHash, name || null]
  );

  const user = result.rows[0];

  // 生成验证令牌
  const verifyToken = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 保存验证记录
  await pool.query(
    `INSERT INTO email_verifications (user_id, email, token, type, expires_at)
     VALUES ($1, $2, $3, 'verify', $4)`,
    [user.id, email.toLowerCase(), verifyToken, expiresAt]
  );

  // 发送验证邮件（异步，不阻塞注册流程）
  sendVerificationEmail(email.toLowerCase(), verifyToken, 'verify')
    .then(sent => {
      if (!sent) console.warn(`验证邮件发送失败: ${email}`);
    })
    .catch(err => console.error('邮件发送异常:', err));

  res.status(201).json({
    success: true,
    message: '注册成功！验证邮件已发送到您的邮箱，请查收并点击链接激活账户。',
    requireVerification: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
}));

module.exports = router;
