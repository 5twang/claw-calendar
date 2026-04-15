// Claw-Calendar - 整合日历视图逻辑

// ─── 全局状态 ──────────────────────────────────────────────────

let calViewMode = 'month';     // 'month' | 'week' | 'day'
let currentDate = new Date();  // 当前视图锚点日期
let allCalendars = [];         // 所有日历
let allEvents = [];            // 所有事件
let selectedCalColor = '#4f46e5';
let editingEventId = null;

// ─── 初始化 ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadAll();
  initNavbar();
  initKeyboardShortcuts();
});

// ─── 快捷键支持 ────────────────────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// 判断是否在输入框/文本域中（不触发快捷键）
function isInputFocused() {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

// 判断是否有 Modal 打开
function hasActiveModal() {
  return document.querySelector('.modal-overlay.active') !== null;
}

function handleKeyboardShortcuts(e) {
  // 如果在输入框中，只有 Esc 和 Enter 生效
  const inInput = isInputFocused();
  const modalOpen = hasActiveModal();

  // Esc - 关闭弹窗
  if (e.key === 'Escape') {
    if (document.getElementById('shortcuts-modal')?.classList.contains('active')) {
      closeShortcutsModal();
      e.preventDefault();
    } else if (document.getElementById('create-event-modal')?.classList.contains('active')) {
      closeCreateEventModal();
      e.preventDefault();
    } else if (document.getElementById('create-calendar-modal')?.classList.contains('active')) {
      closeCreateCalendarModal();
      e.preventDefault();
    } else if (document.getElementById('event-detail-modal')?.classList.contains('active')) {
      closeEventDetailModal();
      e.preventDefault();
    } else if (document.getElementById('subscribe-modal')?.classList.contains('active')) {
      closeSubscribeModal();
      e.preventDefault();
    }
    return;
  }

  // 如果在输入框中，只处理 Enter
  if (inInput) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 根据打开的 Modal 触发保存
      if (document.getElementById('create-event-modal')?.classList.contains('active')) {
        e.preventDefault();
        saveEvent();
      } else if (document.getElementById('create-calendar-modal')?.classList.contains('active')) {
        e.preventDefault();
        createCalendar();
      }
    }
    return;
  }

  // ? - 显示帮助
  if (e.key === '?') {
    e.preventDefault();
    showShortcutsModal();
    return;
  }

  // c - 创建事件
  if (e.key === 'c' || e.key === 'C') {
    e.preventDefault();
    showCreateEventModal(null);
    return;
  }

  // t - 今天
  if (e.key === 't' || e.key === 'T') {
    e.preventDefault();
    goToday();
    return;
  }

  // d - 日视图
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    switchCalView('day');
    return;
  }

  // w - 周视图
  if (e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    switchCalView('week');
    return;
  }

  // m - 月视图
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    switchCalView('month');
    return;
  }

  // ← - 上一期
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigate(-1);
    return;
  }

  // → - 下一期
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigate(1);
    return;
  }
}

// ─── 快捷键 Modal ────────────────────────────────────────────

function showShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('active');
}

function closeShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.remove('active');
}

async function loadAll() {
  await Promise.all([loadCalendarSidebar(), loadEvents()]);
  renderCalView();
}

// ─── 日历 API ─────────────────────────────────────────────────

async function loadCalendarSidebar() {
  const res = await apiFetch('/api/calendars');
  if (res.ok) {
    allCalendars = (await res.json()).calendars || [];
    renderCalendarSidebar();
    populateCalendarSelect();
  } else {
    console.error('加载日历失败:', await res.text());
    allCalendars = [];
  }
}

function renderCalendarSidebar() {
  const el = document.getElementById('calendar-list-sidebar');
  if (!el) return;
  if (allCalendars.length === 0) {
    el.innerHTML = '<div class="sidebar-empty">暂无日历，点击 + 新建</div>';
    return;
  }
  el.innerHTML = allCalendars.map(c => `
    <div class="sidebar-cal-item">
      <span class="cal-dot" style="background:${c.color || '#4f46e5'}"></span>
      <span class="cal-label" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
      <div class="cal-item-actions">
        <button class="btn-icon-xs" onclick="showEditCalendarModal('${c.id}')" title="编辑">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
        </button>
        <button class="btn-icon-xs" onclick="showSubscribeModal('${c.id}')" title="订阅链接">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
        </button>
        <button class="btn-icon-xs danger" onclick="confirmDeleteCalendar('${c.id}')" title="删除">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function populateCalendarSelect() {
  const sel = document.getElementById('event-calendar-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">请选择日历</option>' +
    allCalendars.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

// 创建日历
async function createCalendar() {
  const calendarId = document.getElementById('cal-id').value;
  const name = document.getElementById('cal-name').value.trim();
  const description = document.getElementById('cal-description').value.trim();
  const isPublic = document.getElementById('cal-public').checked;

  if (!name) { showMsg('请输入日历名称', 'error'); return; }

  if (calendarId) {
    // 编辑模式
    const res = await apiFetch(`/api/calendars/${calendarId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, isPublic, color: selectedCalColor })
    });
    const data = await res.json();
    if (res.ok) {
      // 更新本地数据
      const idx = allCalendars.findIndex(c => c.id === calendarId);
      if (idx !== -1) {
        allCalendars[idx] = { ...allCalendars[idx], ...data.calendar };
      }
      closeCreateCalendarModal();
      await loadCalendarSidebar();
      populateCalendarSelect();
      renderCalView();
      showMsg('日历已更新', 'success');
    } else {
      showMsg(data.error || '更新失败', 'error');
    }
  } else {
    // 创建模式
    const res = await apiFetch('/api/calendars', {
      method: 'POST',
      body: JSON.stringify({ name, description, isPublic, color: selectedCalColor })
    });
    const data = await res.json();
    if (res.ok) {
      // 将新日历加入 allCalendars 数组，确保 populateCalendarSelect 有数据
      allCalendars.push(data.calendar);
      closeCreateCalendarModal();
      await loadCalendarSidebar();
      populateCalendarSelect();
      renderCalView();
      showMsg('日历创建成功', 'success');
    } else {
      showMsg(data.error || '创建失败', 'error');
    }
  }
}

// 显示编辑日历模态框
function showEditCalendarModal(calendarId) {
  const cal = allCalendars.find(c => c.id === calendarId);
  if (!cal) return;

  document.getElementById('cal-id').value = cal.id;
  document.getElementById('cal-name').value = cal.name || '';
  document.getElementById('cal-description').value = cal.description || '';
  document.getElementById('cal-public').checked = cal.isPublic || false;

  // 设置颜色
  selectedCalColor = cal.color || '#4f46e5';
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === selectedCalColor);
  });

  document.getElementById('cal-modal-title').textContent = '编辑日历';
  document.getElementById('cal-submit-btn').textContent = '保存';
  document.getElementById('create-calendar-modal').classList.add('active');
  setTimeout(() => document.getElementById('cal-name').focus(), 50);
}

async function confirmDeleteCalendar(id) {
  if (!confirm('确定删除这个日历？日历中的所有日程也将被删除，不可恢复。')) return;
  const res = await apiFetch(`/api/calendars/${id}`, { method: 'DELETE' });
  if (res.ok) {
    allCalendars = allCalendars.filter(c => c.id !== id);
    allEvents = allEvents.filter(e => e.calendarId !== id);
    renderCalendarSidebar();
    populateCalendarSelect();
    renderCalView();
    renderUpcomingEvents();
    showMsg('日历已删除', 'success');
  } else {
    const d = await res.json();
    showMsg(d.error || '删除失败', 'error');
  }
}

// ─── 事件 API ─────────────────────────────────────────────────

async function loadEvents() {
  const res = await apiFetch('/api/calendars/events/all');
  if (res.ok) {
    allEvents = (await res.json()).events || [];
    renderUpcomingEvents();
  }
}

function renderUpcomingEvents() {
  const el = document.getElementById('upcoming-events');
  if (!el) return;

  const today = new Date().toISOString().split('T')[0];
  const upcoming = allEvents
    .filter(e => e.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 20);

  if (upcoming.length === 0) {
    el.innerHTML = '<div class="sidebar-empty">暂无即将到来的日程</div>';
    return;
  }

  // 按日期分组
  const groups = {};
  upcoming.forEach(ev => {
    if (!groups[ev.startDate]) groups[ev.startDate] = [];
    groups[ev.startDate].push(ev);
  });

  el.innerHTML = Object.keys(groups).sort().map(date => {
    const d = new Date(date + 'T00:00:00');
    const isToday = date === today;
    const label = isToday ? '今天' : d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    return `
      <div class="upcoming-group">
        <div class="upcoming-date ${isToday ? 'today' : ''}">${label}</div>
        ${groups[date].map(ev => {
          const cal = allCalendars.find(c => c.id === ev.calendarId);
          const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
          return `
            <div class="upcoming-event" style="border-left-color:${color}">
              <div class="upcoming-event-content">
                ${ev.startTime ? `<span class="upcoming-time">${ev.startTime.substring(0,5)}${ev.endTime ? `-${ev.endTime.substring(0,5)}` : ''}</span>` : ''}
                <span class="upcoming-title">${escapeHtml(ev.title)}</span>
              </div>
              <button class="btn-icon-xs danger" onclick="confirmDeleteEvent('${ev.calendarId}','${ev.id}')" title="删除">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');
}

// 创建事件
function showCreateEventModal(date) {
  console.log('showCreateEventModal called, allCalendars:', allCalendars);
  if (allCalendars.length === 0) {
    showMsg('请先创建日历', 'error');
    return;
  }
  const today = date || new Date().toISOString().split('T')[0];
  
  // 默认当前时间，时长1小时
  const now = new Date();
  const startHour = now.getHours();
  const startMin = now.getMinutes();
  const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const endHour = (startHour + 1) % 24;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  
  document.getElementById('event-start-date').value = today;
  document.getElementById('event-end-date').value = today;
  document.getElementById('event-start-time').value = startTime;
  document.getElementById('event-end-time').value = endTime;
  document.getElementById('event-all-day').checked = false;
  document.getElementById('start-time-group').classList.remove('hidden');
  document.getElementById('end-time-group').classList.remove('hidden');
  document.getElementById('event-title').value = '';
  document.getElementById('event-description').value = '';
  document.getElementById('event-location').value = '';
  document.getElementById('event-calendar-id').value = allCalendars[0]?.id || '';
  document.getElementById('event-modal-title').textContent = '新建日程';
  document.getElementById('create-event-modal').classList.add('active');
  setTimeout(() => document.getElementById('event-title').focus(), 50);
}

// 切换全天选项
function toggleAllDay(checked) {
  const startTimeGroup = document.getElementById('start-time-group');
  const endTimeGroup = document.getElementById('end-time-group');
  if (checked) {
    startTimeGroup.classList.add('form-group--hidden');
    endTimeGroup.classList.add('form-group--hidden');
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
  } else {
    startTimeGroup.classList.remove('form-group--hidden');
    endTimeGroup.classList.remove('form-group--hidden');
    // 恢复默认时间
    const now = new Date();
    const startHour = now.getHours();
    const startMin = now.getMinutes();
    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    const endHour = (startHour + 1) % 24;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    document.getElementById('event-start-time').value = startTime;
    document.getElementById('event-end-time').value = endTime;
  }
}

function closeCreateEventModal() {
  document.getElementById('create-event-modal').classList.remove('active');
}

async function saveEvent() {
  const calendarId = document.getElementById('event-calendar-id').value;
  const title = document.getElementById('event-title').value.trim();
  const startDate = document.getElementById('event-start-date').value;
  const isAllDay = document.getElementById('event-all-day').checked;
  const startTime = isAllDay ? '' : document.getElementById('event-start-time').value;
  const endDate = document.getElementById('event-end-date').value || startDate;
  const endTime = isAllDay ? '' : document.getElementById('event-end-time').value;
  const description = document.getElementById('event-description').value.trim();
  const location = document.getElementById('event-location').value.trim();

  if (!calendarId) { showMsg('请选择日历', 'error'); return; }
  if (!title)      { showMsg('请输入标题', 'error'); return; }
  if (!startDate)  { showMsg('请选择开始日期', 'error'); return; }

  const res = await apiFetch(`/api/calendars/${calendarId}/events`, {
    method: 'POST',
    body: JSON.stringify({ title, startDate, startTime, endDate, endTime, description, location })
  });
  const data = await res.json();
  if (res.ok) {
    closeCreateEventModal();
    await loadEvents();
    // 更新日历事件计数
    const calIdx = allCalendars.findIndex(c => c.id === calendarId);
    if (calIdx !== -1) allCalendars[calIdx].eventCount = (allCalendars[calIdx].eventCount || 0) + 1;
    renderCalendarSidebar();
    renderCalView();
    showMsg('日程创建成功', 'success');
  } else {
    showMsg(data.error || '创建失败', 'error');
  }
}

async function confirmDeleteEvent(calendarId, eventId) {
  if (!confirm('确定删除这个日程？')) return;
  const res = await apiFetch(`/api/calendars/${calendarId}/events/${eventId}`, { method: 'DELETE' });
  if (res.ok) {
    allEvents = allEvents.filter(e => e.id !== eventId);
    renderUpcomingEvents();
    renderCalView();
    showMsg('日程已删除', 'success');
  } else {
    const d = await res.json();
    showMsg(d.error || '删除失败', 'error');
  }
}

// ─── 视图切换 ──────────────────────────────────────────────────

function switchCalView(view) {
  calViewMode = view;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('month-view').classList.toggle('hidden', view !== 'month');
  document.getElementById('week-view').classList.toggle('hidden', view !== 'week');
  document.getElementById('day-view').classList.toggle('hidden', view !== 'day');
  renderCalView();
}

function navigate(dir) {
  if (calViewMode === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  } else {
    currentDate = new Date(currentDate.getTime() + dir * 7 * 86400000);
  }
  renderCalView();
}

function goToday() {
  currentDate = new Date();
  renderCalView();
}

function renderCalView() {
  if (calViewMode === 'month') renderMonthView();
  else if (calViewMode === 'week') renderWeekView();
  else if (calViewMode === 'day') renderDayView();
}

// ─── 月视图 ────────────────────────────────────────────────────

function renderMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById('current-period').textContent =
    `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  // 构建每一格
  const cells = [];
  // 前置空格
  for (let i = 0; i < firstDay; i++) {
    const prevDate = new Date(year, month, -firstDay + i + 1);
    cells.push({ date: fmtDate(prevDate), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, inMonth: true });
  }
  // 补满6行
  while (cells.length < 42) {
    const extra = cells.length - firstDay - daysInMonth + 1;
    const nextDate = new Date(year, month + 1, extra);
    cells.push({ date: fmtDate(nextDate), inMonth: false });
  }

  const grid = document.getElementById('month-grid');
  grid.innerHTML = cells.map(cell => {
    const dayEvents = allEvents.filter(e => e.startDate <= cell.date && e.endDate >= cell.date)
      .sort((a, b) => a.title.localeCompare(b.title));
    const isToday = cell.date === today;
    const dayNum = parseInt(cell.date.split('-')[2]);

    return `
      <div class="month-cell ${cell.inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}"
           onclick="handleDayClick('${cell.date}')">
        <div class="month-day-num ${isToday ? 'today-num' : ''}">${dayNum}</div>
        <div class="month-events">
          ${dayEvents.slice(0, 3).map(ev => {
            const cal = allCalendars.find(c => c.id === ev.calendarId);
            const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
            const timeLabel = ev.startTime ? `<span class="event-time-label">${ev.startTime.substring(0,5)}</span>` : '';
            return `<div class="month-event-chip" style="background:${color}20;color:${color};border-left:3px solid ${color};"
                         onclick="event.stopPropagation();showEventDetail('${ev.id}')"
                         title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}${timeLabel}</div>`;
          }).join('')}
          ${dayEvents.length > 3 ? `<div class="month-more">+${dayEvents.length - 3} 更多</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function handleDayClick(date) {
  showCreateEventModal(date);
}

// ─── 周视图 ────────────────────────────────────────────────────

function renderWeekView() {
  // 找到本周起止
  const day = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - day);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  const startStr = fmtDate(days[0]);
  const endStr = fmtDate(days[6]);
  document.getElementById('current-period').textContent =
    `${days[0].getMonth() + 1}月${days[0].getDate()}日 — ${days[6].getMonth() + 1}月${days[6].getDate()}日`;

  const today = new Date().toISOString().split('T')[0];
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];

  // 渲染日头部（星期 + 日期）
  const dayHeadersEl = document.getElementById('week-day-headers');
  dayHeadersEl.innerHTML = days.map(d => {
    const dateStr = fmtDate(d);
    const isToday = dateStr === today;
    return `<div class="week-day-header ${isToday ? 'today' : ''}">
        <div class="week-day-name">${weekNames[d.getDay()]}</div>
        <div class="week-day-num ${isToday ? 'today-num' : ''}">${d.getDate()}</div>
      </div>`;
  }).join('');

  // 渲染全天事件行
  const allDayRow = document.getElementById('week-all-day-row');
  const allDayCellsHtml = days.map(d => {
    const dateStr = fmtDate(d);
    const isToday = dateStr === today;

    // 找到当天的全天事件
    const dayAllDayEvents = allEvents.filter(e => {
      if (e.startDate > dateStr || e.endDate < dateStr) return false;
      return !e.startTime; // 全天事件没有开始时间
    });

    return `
      <div class="week-all-day-cell ${isToday ? 'today' : ''}" onclick="handleDayClick('${dateStr}')">
        ${dayAllDayEvents.map(ev => {
          const cal = allCalendars.find(c => c.id === ev.calendarId);
          const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
          return `
            <div class="week-all-day-event" style="background:${color};color:white;"
                 onclick="event.stopPropagation();showEventDetail('${ev.id}')"
                 title="${escapeHtml(ev.title)}">
              ${escapeHtml(ev.title)}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');
  allDayRow.innerHTML = `<div class="week-all-day-label">全天</div>${allDayCellsHtml}`;

  // 渲染时间轴（0:00 - 23:00，使用绝对定位显示事件）
  const timeSlots = [];
  for (let hour = 0; hour < 24; hour++) {
    timeSlots.push(hour);
  }

  // 收集每个格子的事件（用于绝对定位）
  const dayEventMap = {}; // dateStr -> [events]

  days.forEach(d => {
    const dateStr = fmtDate(d);
    dayEventMap[dateStr] = [];

    // 找到当天所有带时间的事件
    const dayEvents = allEvents.filter(e => {
      if (e.startDate > dateStr || e.endDate < dateStr) return false;
      if (!e.startTime) return false; // 有开始时间
      return true;
    }).map(e => {
      // 计算事件在时间轴上的位置和高度
      const [startHour, startMin] = e.startTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;

      let endMinutes;
      if (e.endTime) {
        const [endHour, endMin] = e.endTime.split(':').map(Number);
        endMinutes = endHour * 60 + endMin;
      } else {
        // 默认1小时
        endMinutes = startMinutes + 60;
      }

      // 至少15分钟
      const duration = Math.max(endMinutes - startMinutes, 15);
      const rowHeight = 60; // 每小时60px
      const pixelsPerMinute = rowHeight / 60;

      return {
        ...e,
        top: startMinutes * pixelsPerMinute,
        height: duration * pixelsPerMinute,
        startMinutes,
        endMinutes: endMinutes
      };
    });

    // 处理事件重叠（简单的并排布局）
    dayEventMap[dateStr] = calculateEventPositions(dayEvents);
  });

  const grid = document.getElementById('week-grid');

  // 生成时间标签（独立容器）
  const timeLabelsHtml = timeSlots.map(hour => {
    const timeLabel = `${String(hour).padStart(2, '0')}:00`;
    return `<div class="week-time-label-item">${timeLabel}</div>`;
  }).join('');
  document.querySelector('.week-time-labels').innerHTML = timeLabelsHtml;

  // 生成时间轴背景行
  const rowsHtml = timeSlots.map(hour => {
    const dayCellsHtml = days.map(d => {
      const dateStr = fmtDate(d);
      const isToday = dateStr === today;

      return `<div class="week-time-cell ${isToday ? 'today' : ''}" onclick="handleDayClick('${dateStr}')"></div>`;
    }).join('');

    return `<div class="week-row" data-hour="${hour}">${dayCellsHtml}</div>`;
  }).join('');

  // 生成绝对定位的事件层（Grid布局，每列自动对齐）
  const eventsHtml = days.map((d, dayIdx) => {
    const dateStr = fmtDate(d);
    const events = dayEventMap[dateStr] || [];

    // 为每一天的事件创建一个定位容器（由Grid自动分配位置）
    return `
      <div class="week-events-column">
        ${events.map(ev => {
          const cal = allCalendars.find(c => c.id === ev.calendarId);
          const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
          return `
            <div class="week-time-event-absolute"
                 style="background:${color};color:white;top:${ev.top}px;height:${ev.height}px;left:${ev.left}%;width:${ev.width}%;"
                 onclick="event.stopPropagation();showEventDetail('${ev.id}')"
                 title="${escapeHtml(ev.title)} - ${ev.startTime.substring(0,5)}${ev.endTime ? ' - ' + ev.endTime.substring(0,5) : ''}">
              <div class="week-event-title">${escapeHtml(ev.title)}</div>
              <div class="week-event-time">${ev.startTime.substring(0,5)}${ev.endTime ? ' - ' + ev.endTime.substring(0,5) : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');

  // 将事件层包裹在Grid容器中
  const eventsLayerHtml = `<div class="week-events-layer">${eventsHtml}</div>`;

  grid.innerHTML = rowsHtml + eventsLayerHtml;

  // 滚动到8点位置（默认显示8-18点）
  const scrollArea = document.getElementById('week-scroll-area');
  const timeLabels = document.querySelector('.week-time-labels');
  scrollArea.scrollTop = 8 * 60;

  // 同步滚动
  scrollArea.addEventListener('scroll', () => {
    timeLabels.scrollTop = scrollArea.scrollTop;
  });
}

// ─── 日视图 ────────────────────────────────────────────────────

function renderDayView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();
  const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
  const today = new Date().toISOString().split('T')[0];
  const isToday = dateStr === today;

  // 更新标题
  document.getElementById('current-period').textContent =
    `${year}年${month + 1}月${day}日`;

  // 更新日视图头部
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  document.getElementById('day-view-date').textContent = `${month + 1}月${day}日`;
  document.getElementById('day-view-weekday').textContent = weekdays[currentDate.getDay()];
  if (isToday) {
    document.getElementById('day-view-weekday').textContent += '（今天）';
  }

  // 获取当天事件
  const dayEvents = allEvents
    .filter(e => e.startDate <= dateStr && e.endDate >= dateStr)
    .sort((a, b) => a.title.localeCompare(b.title));

  const container = document.getElementById('day-events');
  if (dayEvents.length === 0) {
    container.innerHTML = `
      <div class="day-empty">
        <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style="opacity:0.3;margin-bottom:12px;">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
        <div>当天没有日程</div>
        <button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="showCreateEventModal('${dateStr}')">添加日程</button>
      </div>
    `;
    return;
  }

  container.innerHTML = dayEvents.map(ev => {
    const cal = allCalendars.find(c => c.id === ev.calendarId);
    const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
    return `
      <div class="day-event-item" style="border-left-color:${color}">
        <div class="day-event-main">
          <div class="day-event-title">${escapeHtml(ev.title)}</div>
          <div class="day-event-meta">
            <span class="day-event-time">${ev.startTime ? ev.startTime.substring(0,5) : '全天'}${ev.endTime ? ' - ' + ev.endTime.substring(0,5) : ''}</span>
            <span class="day-event-calendar" style="color:${color}">${escapeHtml(cal ? cal.name : '未知日历')}</span>
            ${ev.location ? `<span>📍 ${escapeHtml(ev.location)}</span>` : ''}
          </div>
          ${ev.description ? `<div class="day-event-desc">${escapeHtml(ev.description)}</div>` : ''}
        </div>
        <button class="btn-icon-xs danger" onclick="confirmDeleteEvent('${ev.calendarId}','${ev.id}')" title="删除">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

// 当前查看的日程ID（用于详情Modal）
let currentDetailEventId = null;

// 事件详情 Modal
function showEventDetail(eventId) {
  const ev = allEvents.find(e => e.id === eventId);
  if (!ev) return;
  currentDetailEventId = eventId;
  
  const cal = allCalendars.find(c => c.id === ev.calendarId);
  const color = ev.calendarColor || (cal ? cal.color : '#4f46e5');
  
  // 构建时间显示（只显示到分钟，截取 HH:mm）
  let timeDisplay = '';
  if (ev.startTime) {
    // 有具体时间
    const startTimeMin = ev.startTime.substring(0, 5);
    const endTimeMin = ev.endTime ? ev.endTime.substring(0, 5) : null;
    const start = `${ev.startDate} ${startTimeMin}`;
    const end = endTimeMin ? `${ev.endDate} ${endTimeMin}` : ev.endDate;
    timeDisplay = `<div style="display:flex;align-items:center;gap:8px;color:var(--gray-600);">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
      <span>${start}${end !== start ? ' ~ ' + end : ''}</span>
    </div>`;
  } else {
    // 全天事件
    const dateRange = ev.endDate !== ev.startDate ? `${ev.startDate} ~ ${ev.endDate}` : ev.startDate;
    timeDisplay = `<div style="display:flex;align-items:center;gap:8px;color:var(--gray-600);">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
      <span>${dateRange} （全天）</span>
    </div>`;
  }
  
  // 构建内容
  let html = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="width:12px;height:12px;border-radius:50%;background:${color};"></span>
        <span style="font-size:0.9rem;color:var(--gray-500);">${cal ? cal.name : '未知日历'}</span>
      </div>
      <h2 style="font-size:1.25rem;font-weight:600;color:var(--gray-900);margin:0 0 12px 0;">${escapeHtml(ev.title)}</h2>
      ${timeDisplay}
    </div>
  `;
  
  if (ev.location) {
    html += `<div style="display:flex;align-items:center;gap:8px;color:var(--gray-600);margin-bottom:8px;">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
      <span>${escapeHtml(ev.location)}</span>
    </div>`;
  }
  
  if (ev.description) {
    html += `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-200);">
      <div style="font-size:0.85rem;color:var(--gray-500);margin-bottom:4px;">备注</div>
      <div style="color:var(--gray-700);white-space:pre-wrap;">${escapeHtml(ev.description)}</div>
    </div>`;
  }
  
  document.getElementById('detail-title').textContent = '日程详情';
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('detail-delete-btn').onclick = () => deleteEventFromDetail(ev.calendarId, ev.id);
  document.getElementById('event-detail-modal').classList.add('active');
}

function closeEventDetailModal() {
  document.getElementById('event-detail-modal').classList.remove('active');
  currentDetailEventId = null;
}

async function deleteEventFromDetail(calendarId, eventId) {
  if (!confirm('确定删除这个日程？')) return;
  const res = await apiFetch(`/api/calendars/${calendarId}/events/${eventId}`, { method: 'DELETE' });
  if (res.ok) {
    allEvents = allEvents.filter(e => e.id !== eventId);
    closeEventDetailModal();
    renderUpcomingEvents();
    renderCalView();
    showMsg('日程已删除', 'success');
  } else {
    const d = await res.json();
    showMsg(d.error || '删除失败', 'error');
  }
}

// ─── 日历 Modal 辅助 ──────────────────────────────────────────

function showCreateCalendarModal() {
  document.getElementById('cal-id').value = '';
  document.getElementById('cal-name').value = '';
  document.getElementById('cal-description').value = '';
  document.getElementById('cal-public').checked = false;
  selectedCalColor = '#4f46e5';
  document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === selectedCalColor));
  document.getElementById('cal-modal-title').textContent = '新建日历';
  document.getElementById('cal-submit-btn').textContent = '创建';
  document.getElementById('create-calendar-modal').classList.add('active');
  setTimeout(() => document.getElementById('cal-name').focus(), 50);
}

function closeCreateCalendarModal() {
  document.getElementById('cal-id').value = '';
  document.getElementById('create-calendar-modal').classList.remove('active');
}

function selectColor(color, btn) {
  selectedCalColor = color;
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  btn.classList.add('active');
}

// 订阅 Modal
let currentSubscribeCalId = null;

async function showSubscribeModal(calendarId) {
  currentSubscribeCalId = calendarId;
  let cal = allCalendars.find(c => c.id === calendarId);
  if (!cal) return;
  
  // 旧日历没有 token，自动生成一个
  if (!cal.subscribeToken) {
    try {
      const res = await apiFetch(`/api/calendars/${calendarId}/reset-token`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        cal.subscribeToken = data.subscribeToken;
      } else {
        showMsg(data.error || '生成订阅链接失败', 'error');
        return;
      }
    } catch (err) {
      console.error('生成订阅链接失败:', err);
      showMsg('生成订阅链接失败', 'error');
      return;
    }
  }
  
  const token = cal.subscribeToken;
  const url = `${location.origin}/api/calendars/${calendarId}/ical?token=${token}`;
  document.getElementById('subscribe-url').value = url;
  document.getElementById('subscribe-modal').classList.add('active');
}

function closeSubscribeModal() {
  document.getElementById('subscribe-modal').classList.remove('active');
  currentSubscribeCalId = null;
}

function copySubscribeUrl() {
  const input = document.getElementById('subscribe-url');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => showMsg('链接已复制', 'success'));
}

// 重置订阅 Token
async function resetSubscribeToken() {
  if (!currentSubscribeCalId) return;
  if (!confirm('重置后，旧的订阅链接将失效，需要在手机日历中重新配置。确定重置？')) return;
  
  try {
    const res = await apiFetch(`/api/calendars/${currentSubscribeCalId}/reset-token`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      // 更新本地数据
      const cal = allCalendars.find(c => c.id === currentSubscribeCalId);
      if (cal) cal.subscribeToken = data.subscribeToken;
      // 更新 URL 显示
      const url = `${location.origin}/api/calendars/${currentSubscribeCalId}/ical?token=${data.subscribeToken}`;
      document.getElementById('subscribe-url').value = url;
      showMsg('订阅链接已重置', 'success');
    } else {
      showMsg(data.error || '重置失败', 'error');
    }
  } catch (err) {
    showMsg('重置失败', 'error');
  }
}

// ─── 通用工具 ─────────────────────────────────────────────────

function showMsg(msg, type = 'success') {
  // 使用 Toast 通知替代页面内提示
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      ${type === 'success'
        ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>'
      }
    </svg>
    <span>${msg}</span>
  `;

  container.appendChild(toast);

  // 4秒后自动移除
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}



function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// 计算重叠事件的布局位置
function calculateEventPositions(events) {
  if (events.length === 0) return [];

  // 按开始时间排序
  const sortedEvents = [...events].sort((a, b) => a.startMinutes - b.startMinutes);

  // 简单的贪心算法：为每个事件分配列
  const columns = [];

  sortedEvents.forEach(ev => {
    let placed = false;

    // 尝试放入已有列
    for (let i = 0; i < columns.length; i++) {
      const lastEventInColumn = columns[i][columns[i].length - 1];
      if (ev.startMinutes >= lastEventInColumn.endMinutes) {
        // 不重叠，放入该列
        columns[i].push(ev);
        ev.column = i;
        ev.totalColumns = columns.length;
        placed = true;
        break;
      }
    }

    // 如果无法放入已有列，创建新列
    if (!placed) {
      columns.push([ev]);
      ev.column = columns.length - 1;
      ev.totalColumns = columns.length;
    }
  });

  // 为每个事件计算 left 和 width 百分比
  sortedEvents.forEach(ev => {
    ev.left = (ev.column / ev.totalColumns) * 100;
    ev.width = (1 / ev.totalColumns) * 100;
  });

  return sortedEvents;
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
