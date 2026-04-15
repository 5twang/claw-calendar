/**
 * 安全与加密配置模块
 * 
 * 支持三种加密级别：
 * - standard: 仅加密敏感字段（描述、地点）
 * - full: 全业务数据加密（标题、描述、地点）- 默认
 * - maximum: 最高级别（包含日历名称和描述）
 */

const crypto = require('../utils/crypto');

// 加密级别配置
const ENCRYPTION_LEVEL = process.env.ENCRYPTION_LEVEL || 'full';

// 各级别对应的加密字段
const ENCRYPTION_CONFIG = {
  standard: {
    name: '标准加密',
    description: '仅加密敏感字段（描述、地点）',
    eventFields: ['description', 'location'],
    calendarFields: ['description']
  },
  full: {
    name: '全数据加密',
    description: '加密所有业务数据（标题、描述、地点）',
    eventFields: ['title', 'description', 'location'],
    calendarFields: ['description']
  },
  maximum: {
    name: '最高加密',
    description: '加密所有数据包括日历信息',
    eventFields: ['title', 'description', 'location'],
    calendarFields: ['name', 'description']
  }
};

/**
 * 获取当前加密配置
 */
function getEncryptionConfig() {
  return ENCRYPTION_CONFIG[ENCRYPTION_LEVEL] || ENCRYPTION_CONFIG.full;
}

/**
 * 获取事件加密字段
 */
function getEventEncryptedFields() {
  return getEncryptionConfig().eventFields;
}

/**
 * 获取日历加密字段
 */
function getCalendarEncryptedFields() {
  return getEncryptionConfig().calendarFields;
}

/**
 * 加密事件数据（用于写入数据库前）
 * @param {Object} eventData - 事件数据
 * @returns {Object} - 加密后的事件数据
 */
function encryptEventData(eventData) {
  const fields = getEventEncryptedFields();
  return crypto.encryptFields(eventData, fields);
}

/**
 * 解密事件数据（从数据库读取后）
 * @param {Object} eventData - 数据库中的事件数据
 * @returns {Object} - 解密后的事件数据
 */
function decryptEventData(eventData) {
  const fields = getEventEncryptedFields();
  return crypto.decryptFields(eventData, fields);
}

/**
 * 批量解密事件列表
 * @param {Array} events - 事件数组
 * @returns {Array} - 解密后的事件数组
 */
function decryptEventList(events) {
  const fields = getEventEncryptedFields();
  return crypto.decryptArray(events, fields);
}

/**
 * 加密日历数据（用于写入数据库前）
 * @param {Object} calendarData - 日历数据
 * @returns {Object} - 加密后的日历数据
 */
function encryptCalendarData(calendarData) {
  const fields = getCalendarEncryptedFields();
  return crypto.encryptFields(calendarData, fields);
}

/**
 * 解密日历数据（从数据库读取后）
 * @param {Object} calendarData - 数据库中的日历数据
 * @returns {Object} - 解密后的日历数据
 */
function decryptCalendarData(calendarData) {
  const fields = getCalendarEncryptedFields();
  return crypto.decryptFields(calendarData, fields);
}

/**
 * 批量解密日历列表
 * @param {Array} calendars - 日历数组
 * @returns {Array} - 解密后的日历数组
 */
function decryptCalendarList(calendars) {
  const fields = getCalendarEncryptedFields();
  return crypto.decryptArray(calendars, fields);
}

/**
 * 获取当前安全状态摘要（用于健康检查）
 * 注意：只返回非敏感信息
 */
function getSecurityStatus() {
  const config = getEncryptionConfig();
  return {
    encryptionEnabled: ENCRYPTION_LEVEL !== 'standard',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ENCRYPTION_LEVEL,
  getEncryptionConfig,
  getEventEncryptedFields,
  getCalendarEncryptedFields,
  encryptEventData,
  decryptEventData,
  decryptEventList,
  encryptCalendarData,
  decryptCalendarData,
  decryptCalendarList,
  getSecurityStatus
};
