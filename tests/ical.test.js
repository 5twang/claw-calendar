const {
  parseICalEvent,
  getCurrentTimestamp,
  formatDateForICal,
  formatTimeForICal
} = require('../src/utils/ical');

describe('ical.js 工具函数', () => {
  describe('parseICalEvent', () => {
    test('解析全天事件', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240315
DTEND;VALUE=DATE:20240316
SUMMARY:全天会议
DESCRIPTION:这是一天活动
LOCATION:会议室A
UID:test-event-1
END:VEVENT
END:VCALENDAR`;

      const result = parseICalEvent(ical, 'test-event-1');

      expect(result).not.toBeNull();
      expect(result.startDate).toBe('2024-03-15');
      expect(result.endDate).toBe('2024-03-16');
      expect(result.title).toBe('全天会议');
      expect(result.description).toBe('这是一天活动');
      expect(result.location).toBe('会议室A');
      expect(result.isAllDay).toBe(true);
    });

    test('解析带时间事件', () => {
      const ical = `BEGIN:VEVENT
DTSTART:20240315T090000
DTEND:20240315T100000
SUMMARY:上午会议
UID:test-event-2
END:VEVENT`;

      const result = parseICalEvent(ical, 'test-event-2');

      expect(result).not.toBeNull();
      expect(result.startDate).toBe('2024-03-15');
      expect(result.startTime).toBe('09:00:00');
      expect(result.endDate).toBe('2024-03-15');
      expect(result.endTime).toBe('10:00:00');
      expect(result.title).toBe('上午会议');
      expect(result.isAllDay).toBe(false);
    });

    test('处理转义字符', () => {
      const ical = `BEGIN:VEVENT
DTSTART;VALUE=DATE:20240315
DTEND;VALUE=DATE:20240315
SUMMARY:测试
DESCRIPTION:第一行\\n第二行\\,逗号
UID:test-event-3
END:VEVENT`;

      const result = parseICalEvent(ical, 'test-event-3');

      expect(result.description).toBe('第一行\n第二行,逗号');
    });

    test('缺少 UID 返回 null', () => {
      const ical = `BEGIN:VEVENT
DTSTART;VALUE=DATE:20240315
DTEND;VALUE=DATE:20240315
SUMMARY:无UID事件
END:VEVENT`;

      const result = parseICalEvent(ical, null);

      expect(result).toBeNull();
    });

    test('使用提供 UID', () => {
      const ical = `BEGIN:VEVENT
DTSTART;VALUE=DATE:20240315
DTEND;VALUE=DATE:20240315
SUMMARY:使用提供UID
END:VEVENT`;

      const result = parseICalEvent(ical, 'provided-uid');

      expect(result.uid).toBe('provided-uid');
    });

    test('DTEND 缺省时使用 DTSTART', () => {
      const ical = `BEGIN:VEVENT
DTSTART;VALUE=DATE:20240315
SUMMARY:无结束时间
UID:test-no-end
END:VEVENT`;

      const result = parseICalEvent(ical, 'test-no-end');

      expect(result.endDate).toBe(result.startDate);
    });
  });

  describe('getCurrentTimestamp', () => {
    test('返回 ISO 格式时间戳', () => {
      const timestamp = getCurrentTimestamp();

      expect(timestamp).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('formatDateForICal', () => {
    test('转换日期格式', () => {
      expect(formatDateForICal('2024-03-15')).toBe('20240315');
    });
  });

  describe('formatTimeForICal', () => {
    test('转换时间格式', () => {
      expect(formatTimeForICal('09:30:00')).toBe('093000');
    });

    test('空时间返回默认值', () => {
      expect(formatTimeForICal(null)).toBe('000000');
    });
  });
});
