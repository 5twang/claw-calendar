// Claw-Calendar - 日程管理功能

/**
 * 显示全局消息提示
 * @param {string} message - 消息内容
 * @param {string} type - success | error | warning | info
 */
function showGlobalMessage(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconSvg = type === 'success'
    ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // 3秒后自动隐藏
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 获取日程列表
async function fetchEvents(calendarId = null) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    let url = '/api/events';
    if (calendarId) {
      url = `/api/calendars/${calendarId}/events`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, events: data.events || [] };
    } else {
      return { success: false, error: data.error || '获取日程列表失败' };
    }
  } catch (error) {
    console.error('获取日程列表失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 获取日历列表（用于下拉选择）
async function fetchCalendarsForSelect() {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    const response = await fetch('/api/calendars', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, calendars: data.calendars || [] };
    } else {
      return { success: false, error: data.error || '获取日历列表失败' };
    }
  } catch (error) {
    console.error('获取日历列表失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 创建日程
async function createEventApi(eventData) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    const response = await fetch(`/api/calendars/${eventData.calendarId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        isAllDay: eventData.isAllDay,
        alarmEnabled: eventData.alarmEnabled,
        alarmMinutes: eventData.alarmMinutes
      })
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, event: data.event };
    } else {
      return { success: false, error: data.error || '创建日程失败' };
    }
  } catch (error) {
    console.error('创建日程失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 删除日程
async function deleteEventApi(calendarId, eventId) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    const response = await fetch(`/api/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, deletedEvent: data.deletedEvent };
    } else {
      return { success: false, error: data.error || '删除日程失败' };
    }
  } catch (error) {
    console.error('删除日程失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 恢复已删除的事件
async function restoreEventApi(eventId, eventData) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    const response = await fetch(`/api/calendars/${eventData.calendarId}/events/${eventId}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(eventData)
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || '恢复日程失败' };
    }
  } catch (error) {
    console.error('恢复日程失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 待撤销的事件数据
let pendingUndo = null;
let undoTimer = null;
let undoTimeout = 5000; // 5秒内可撤销

// 显示撤销提示
function showUndoMessage(message, eventData, eventId, calendarId) {
  // 清除之前的撤销状态
  if (undoTimer) {
    clearTimeout(undoTimer);
    pendingUndo = null;
  }

  // 保存待撤销的数据
  pendingUndo = { eventData, eventId, calendarId };

  const container = document.getElementById('toast-container');
  if (!container) return;

  const undoIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>';
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.innerHTML = `${undoIcon}<span>${message}</span><a href="#" id="undo-btn" style="color: rgba(255,255,255,0.85); text-decoration: underline; font-weight: 600;">撤销</a>`;

  container.appendChild(toast);

  // 绑定撤销按钮事件
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.onclick = async () => {
      if (pendingUndo) {
        undoBtn.textContent = '恢复中...';
        undoBtn.disabled = true;

        const result = await restoreEventApi(pendingUndo.eventId, pendingUndo.eventData);

        if (result.success) {
          loadEvents();
          // 显示恢复成功提示
          showGlobalMessage('日程已恢复', 'success');
        } else {
          showGlobalMessage(result.error?.message || result.error, 'error');
        }

        pendingUndo = null;
        if (undoTimer) {
          clearTimeout(undoTimer);
          undoTimer = null;
        }
        // 移除 toast
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
      }
    };
  }

  // 5秒后自动隐藏
  undoTimer = setTimeout(() => {
    pendingUndo = null;
    undoTimer = null;
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, undoTimeout);
}

// 渲染日程列表
function renderEventList(events, calendars) {
  const container = document.getElementById('event-list');
  const calendarMap = {};
  calendars.forEach(cal => {
    calendarMap[cal.id] = cal;
  });

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--gray-400); margin-bottom: 16px;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <p>还没有日程</p>
        <p class="text-secondary" style="font-size: 0.9rem;">点击上方按钮创建你的第一个日程</p>
      </div>
    `;
    return;
  }

  // 按日期分组
  const groupedEvents = {};
  events.forEach(event => {
    const date = event.startDate;
    if (!groupedEvents[date]) {
      groupedEvents[date] = [];
    }
    groupedEvents[date].push(event);
  });

  // 按日期排序
  const sortedDates = Object.keys(groupedEvents).sort();

  container.innerHTML = sortedDates.map(date => {
    const dateEvents = groupedEvents[date];
    // 修复日期解析问题：确保日期字符串格式正确
    const dateStr = date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (m, y, mo, d) => {
      const dateObj = new Date(y, parseInt(mo) - 1, d);
      return dateObj.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    });
    // 检查是否是今天
    const today = new Date();
    const eventDate = new Date(date + 'T12:00:00'); // 使用中午避免时区问题
    const isToday = today.getFullYear() === eventDate.getFullYear() &&
                    today.getMonth() === eventDate.getMonth() &&
                    today.getDate() === eventDate.getDate();

    return `
      <div class="event-date-group">
        <div class="event-date-header ${isToday ? 'today' : ''}">
          <span class="event-date-title">${dateStr}</span>
          ${isToday ? '<span class="event-today-badge">今天</span>' : ''}
        </div>
        <div class="event-date-items">
          ${dateEvents.map(event => {
            const calendar = calendarMap[event.calendarId];
            return `
              <div class="event-item" data-event-id="${event.id}" data-calendar-id="${event.calendarId}">
                <div class="event-content">
                  <h4 class="event-title">${escapeHtml(event.title)}</h4>
                  ${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ''}
                  ${event.location ? `<p class="event-location">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                    </svg>
                    ${escapeHtml(event.location)}
                  </p>` : ''}
                  <div class="event-meta">
                    <span class="event-calendar-badge" style="background: ${calendar ? 'var(--primary-light)' : 'var(--gray-200)'}; color: ${calendar ? 'var(--primary)' : 'var(--gray-600)'};">
                      ${calendar ? escapeHtml(calendar.name) : '未知日历'}
                    </span>
                    ${event.isAllDay ? '<span class="event-badge">全天</span>' : ''}
                    ${event.alarmEnabled ? `
                      <span class="event-badge alarm">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                        </svg>
                        ${formatAlarmMinutes(event.alarmMinutes)}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <button class="btn-icon btn-icon-danger" onclick="deleteEvent('${event.calendarId}', '${event.id}')" title="删除">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// 格式化提醒时间
function formatAlarmMinutes(minutes) {
  if (minutes === 0) return '开始时';
  if (minutes < 60) return `提前 ${minutes} 分钟`;
  if (minutes < 1440) return `提前 ${Math.floor(minutes / 60)} 小时`;
  return `提前 ${Math.floor(minutes / 1440)} 天`;
}

// 加载并显示日程列表
async function loadEvents() {
  const calendarFilter = document.getElementById('calendar-filter');
  const selectedCalendar = calendarFilter ? calendarFilter.value : '';

  const [eventsResult, calendarsResult] = await Promise.all([
    fetchEvents(selectedCalendar || null),
    fetchCalendarsForSelect()
  ]);

  if (eventsResult.success && calendarsResult.success) {
    renderEventList(eventsResult.events, calendarsResult.calendars);
  } else {
    showGlobalMessage((eventsResult.error?.message || eventsResult.error) || (calendarsResult.error?.message || calendarsResult.error), 'error');
  }
}

// 加载日历选项到下拉框
async function loadCalendarOptions() {
  const result = await fetchCalendarsForSelect();
  if (!result.success) return;

  const calendars = result.calendars;
  const filterSelect = document.getElementById('calendar-filter');
  const modalSelect = document.getElementById('event-calendar');

  const optionsHtml = calendars.map(cal =>
    `<option value="${cal.id}">${escapeHtml(cal.name)}</option>`
  ).join('');

  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">所有日历</option>' + optionsHtml;
  }
  if (modalSelect) {
    modalSelect.innerHTML = '<option value="">请选择日历</option>' + optionsHtml;
  }
}

// 显示创建日程模态框
function showCreateEventModal() {
  document.getElementById('create-event-modal').classList.add('active');
  document.getElementById('event-title').focus();

  // 设置默认日期为今天
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('event-start-date').value = today;
  document.getElementById('event-end-date').value = today;
}

// 关闭创建日程模态框
function closeCreateEventModal() {
  document.getElementById('create-event-modal').classList.remove('active');
  document.getElementById('event-calendar').value = '';
  document.getElementById('event-title').value = '';
  document.getElementById('event-description').value = '';
  document.getElementById('event-location').value = '';
  document.getElementById('event-start-date').value = '';
  document.getElementById('event-end-date').value = '';
  document.getElementById('event-all-day').checked = true;
  document.getElementById('event-alarm').checked = true;
  document.getElementById('event-alarm-minutes').value = '15';
}

// 切换时间输入显示
function toggleTimeInputs() {
  // 目前只支持全天事件，后续可以扩展
}

// 创建日程
async function createEvent() {
  const calendarId = document.getElementById('event-calendar').value;
  const title = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const location = document.getElementById('event-location').value.trim();
  const startDate = document.getElementById('event-start-date').value;
  const endDate = document.getElementById('event-end-date').value;
  const isAllDay = document.getElementById('event-all-day').checked;
  const alarmEnabled = document.getElementById('event-alarm').checked;
  const alarmMinutes = parseInt(document.getElementById('event-alarm-minutes').value);

  if (!calendarId) {
    showGlobalMessage('请选择日历', 'warning');
    return;
  }
  if (!title) {
    showGlobalMessage('请输入日程标题', 'warning');
    return;
  }
  if (!startDate || !endDate) {
    showGlobalMessage('请选择开始和结束日期', 'warning');
    return;
  }
  if (startDate > endDate) {
    showGlobalMessage('结束日期不能早于开始日期', 'warning');
    return;
  }

  // 显示加载状态
  const submitBtn = document.getElementById('event-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中...';
  }

  const result = await createEventApi({
    calendarId,
    title,
    description,
    location,
    startDate,
    endDate,
    isAllDay,
    alarmEnabled,
    alarmMinutes
  });

  // 恢复按钮状态
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '创建';
  }

  if (result.success) {
    showGlobalMessage('日程创建成功', 'success');
    closeCreateEventModal();
    loadEvents();
  } else {
    showGlobalMessage(result.error?.message || result.error, 'error');
  }
}

// 直接删除日程（带撤销）
function deleteEvent(calendarId, eventId) {
  deleteEventApi(calendarId, eventId).then(result => {
    if (result.success) {
      showUndoMessage('日程已删除', result.deletedEvent, eventId, calendarId);
      loadEvents();
    } else {
      showGlobalMessage(result.error?.message || result.error, 'error');
    }
  });
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initNavbar();
  loadCalendarOptions();
  loadEvents();
});
