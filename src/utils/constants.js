/**
 * 全局常量配置
 * 统一管理时区、默认颜色等全局配置
 */

const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_CALENDAR_COLOR = '#4f46e5';

/**
 * 验证颜色格式，返回有效颜色或默认值
 * @param {string} color - 待验证的颜色
 * @returns {string} 有效颜色或默认颜色
 */
function validateColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : DEFAULT_CALENDAR_COLOR;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} dateValue - 日期值
 * @returns {string|null} YYYY-MM-DD 格式日期
 */
function formatDateForApi(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    return dateValue.split('T')[0];
  }
  return dateValue.toISOString().split('T')[0];
}

/**
 * 格式化完整时间戳为 ISO 字符串
 * @param {string|Date} dateValue - 日期值
 * @returns {string|null} ISO 格式时间戳
 */
function formatDateTime(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue.toISOString();
  return new Date(dateValue).toISOString();
}

module.exports = {
  DEFAULT_TIMEZONE,
  DEFAULT_CALENDAR_COLOR,
  validateColor,
  formatDateForApi,
  formatDateTime
};
