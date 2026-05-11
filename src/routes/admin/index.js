/**
 * Admin 路由聚合
 * 
 * 挂载 admin 认证路由和用户管理路由
 * - /api/admin/auth/login - 管理员登录
 * - /api/admin/users - 用户管理（需要 admin 权限）
 */

const express = require('express');
const router = express.Router();

const adminAuthRouter = require('./auth');
const adminUsersRouter = require('./users');

// 管理员登录（无需 admin 权限）
router.use('/auth', adminAuthRouter);

// 用户管理（需 admin 权限）
router.use('/users', adminUsersRouter);

module.exports = router;
