/**
 * iCal 数据解析工具
 */

/**
 * 解析 iCal 格式的事件数据
 * @param {string} icalData - iCal 格式的字符串
 * @param {string} providedUid - 提供的 UID
 * @returns {object|null} 解析后的事件对象
 */
function parseICalEvent(icalData, providedUid) {
  const lines = icalData.split(/\r?\n/);
  const event = {};

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);
    const key = rawKey.split(';')[0];

    if (key === 'DTSTART') {
      if (rawKey.includes('VALUE=DATE')) {
        event.startDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        event.isAllDay = true;
      } else {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.startDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.startTime = `${match[4]}:${match[5]}:${match[6]}`;
          event.isAllDay = false;
        }
      }
    } else if (key === 'DTEND') {
      if (rawKey.includes('VALUE=DATE')) {
        event.endDate = value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      } else {
        const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
          event.endDate = `${match[1]}-${match[2]}-${match[3]}`;
          event.endTime = `${match[4]}:${match[5]}:${match[6]}`;
        }
      }
    } else if (key === 'SUMMARY') {
      event.title = value;
    } else if (key === 'DESCRIPTION') {
      event.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    } else if (key === 'LOCATION') {
      event.location = value;
    } else if (key === 'UID') {
      event.uid = value;
    }
  }

  if (!event.uid && providedUid) event.uid = providedUid;
  if (!event.endDate) event.endDate = event.startDate;
  if (event.isAllDay && !event.endTime) event.endTime = '23:59:59';

  return event.uid ? event : null;
}

/**
 * 生成 iCal 格式的时间戳
 * @returns {string} ISO 时间戳字符串
 */
function getCurrentTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * 格式化日期为 iCal DATE 格式
 * @param {string} date - YYYY-MM-DD 格式日期
 * @returns {string} YYYYMMDD 格式
 */
function formatDateForICal(date) {
  return date.replace(/-/g, '');
}

/**
 * 格式化时间为 iCal TIME 格式
 * @param {string} time - HH:mm:ss 格式时间
 * @returns {string} HHmmss 格式
 */
function formatTimeForICal(time) {
  return time ? time.replace(/:/g, '') : '000000';
}

module.exports = {
  parseICalEvent,
  getCurrentTimestamp,
  formatDateForICal,
  formatTimeForICal
};
