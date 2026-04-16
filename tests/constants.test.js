/**
 * 常量配置测试
 */

const {
  DEFAULT_TIMEZONE,
  DEFAULT_CALENDAR_COLOR,
  validateColor,
  formatDateForApi,
  formatDateTime
} = require('../src/utils/constants');

describe('常量配置', () => {
  describe('DEFAULT_TIMEZONE', () => {
    test('应该是 Asia/Shanghai', () => {
      expect(DEFAULT_TIMEZONE).toBe('Asia/Shanghai');
    });
  });

  describe('DEFAULT_CALENDAR_COLOR', () => {
    test('应该是 #4f46e5', () => {
      expect(DEFAULT_CALENDAR_COLOR).toBe('#4f46e5');
    });
  });
});

describe('validateColor', () => {
  test('应该接受有效的 6 位十六进制颜色', () => {
    expect(validateColor('#FF5733')).toBe('#FF5733');
    expect(validateColor('#ffffff')).toBe('#ffffff');
    expect(validateColor('#000000')).toBe('#000000');
  });

  test('应该拒绝无效颜色并返回默认值', () => {
    expect(validateColor('red')).toBe(DEFAULT_CALENDAR_COLOR);
    expect(validateColor('#FFF')).toBe(DEFAULT_CALENDAR_COLOR);
    expect(validateColor('#GGG')).toBe(DEFAULT_CALENDAR_COLOR);
    expect(validateColor('')).toBe(DEFAULT_CALENDAR_COLOR);
    expect(validateColor(null)).toBe(DEFAULT_CALENDAR_COLOR);
    expect(validateColor(undefined)).toBe(DEFAULT_CALENDAR_COLOR);
  });
});

describe('formatDateForApi', () => {
  test('应该处理 YYYY-MM-DD 格式字符串', () => {
    expect(formatDateForApi('2025-01-15')).toBe('2025-01-15');
  });

  test('应该从 ISO 字符串提取日期部分', () => {
    expect(formatDateForApi('2025-01-15T10:30:00.000Z')).toBe('2025-01-15');
    expect(formatDateForApi('2025-01-15T23:59:59.999Z')).toBe('2025-01-15');
  });

  test('应该处理 Date 对象', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    expect(formatDateForApi(date)).toBe('2025-01-15');
  });

  test('应该处理 null 和 undefined', () => {
    expect(formatDateForApi(null)).toBeNull();
    expect(formatDateForApi(undefined)).toBeNull();
  });
});

describe('formatDateTime', () => {
  test('应该返回 ISO 字符串格式', () => {
    const result = formatDateTime(new Date('2025-01-15T10:30:00.000Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  test('应该处理字符串日期', () => {
    const result = formatDateTime('2025-01-15T10:30:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('应该处理 null 和 undefined', () => {
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime(undefined)).toBeNull();
  });
});
