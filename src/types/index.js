/**
 * 类型定义索引
 * 导出所有类型定义和 Schema
 */

// API 类型定义
const api = require('./api');

// Zod Schema (用于验证)
const schemas = require('./schemas');

module.exports = {
  ...api,
  schemas
};
