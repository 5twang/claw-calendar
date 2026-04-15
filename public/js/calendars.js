// Claw-Calendar - 日历管理功能

// 全局变量
let calendars = [];
let filteredCalendars = [];
let selectedCalendarIds = new Set();
let currentView = 'list'; // 'list' or 'grid'

// 获取日历列表
async function fetchCalendars() {
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

// 创建日历
async function createCalendarApi(name, description, isPublic) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch('/api/calendars', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        description,
        isPublic
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, calendar: data.calendar };
    } else {
      return { success: false, error: data.error || '创建日历失败' };
    }
  } catch (error) {
    console.error('创建日历失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 删除日历
async function deleteCalendarApi(calendarId) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch(`/api/calendars/${calendarId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || '删除日历失败' };
    }
  } catch (error) {
    console.error('删除日历失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 渲染日历列表
function renderCalendarList(calendars) {
  const container = document.getElementById('calendar-list');
  
  if (calendars.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--gray-400); margin-bottom: 16px;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <p>还没有日历</p>
        <p class="text-secondary" style="font-size: 0.9rem;">点击上方按钮创建你的第一个日历</p>
      </div>
    `;
    return;
  }
  
  // 根据当前视图模式渲染
  if (currentView === 'grid') {
    container.innerHTML = calendars.map(calendar => renderCalendarGridItem(calendar)).join('');
  } else {
    container.innerHTML = calendars.map(calendar => {
      const isSelected = selectedCalendarIds.has(calendar.id);
      return `
      <div class="calendar-item ${isSelected ? 'selected' : ''}" data-calendar-id="${calendar.id}">
        <div class="calendar-header">
          <div class="calendar-name-wrapper">
            <div class="calendar-checkbox">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCalendarSelection('${calendar.id}', this.checked)">
            </div>
            <span class="calendar-name" id="calendar-name-${calendar.id}" onclick="startEditCalendarName('${calendar.id}', '${escapeHtml(calendar.name)}')">${escapeHtml(calendar.name)}</span>
            <button class="btn-icon" onclick="startEditCalendarName('${calendar.id}', '${escapeHtml(calendar.name)}')" title="修改名称">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
          </div>
          ${calendar.isPublic ? '<span class="calendar-badge public">公开</span>' : '<span class="calendar-badge private">私有</span>'}
        </div>
        
        ${calendar.description ? `<p class="calendar-description">${escapeHtml(calendar.description)}</p>` : ''}
        
        <div class="calendar-meta">
          <span>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
            </svg>
            创建: ${formatDate(calendar.createdAt)}
          </span>
          <span>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
            </svg>
            ${calendar.eventCount || 0} 个日程
          </span>
        </div>
        
        <div class="calendar-actions">
          <a href="/events.html?calendar=${calendar.id}" class="btn btn-sm btn-secondary">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
            </svg>
            管理日程
          </a>
          ${calendar.isPublic ? `
          <button class="btn btn-sm btn-secondary" onclick="showSubscribeModal('${calendar.id}')">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/>
              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"/>
            </svg>
            订阅链接
          </button>
          ` : ''}
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteCalendar('${calendar.id}')">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            删除
          </button>
        </div>
      </div>
    `}).join('');
  }
}

// 加载并显示日历列表
async function loadCalendars() {
  const result = await fetchCalendars();
  if (result.success) {
    calendars = result.calendars;
    filteredCalendars = calendars;
    renderCalendarList(filteredCalendars);
  } else {
    showMessage('calendar-message', result.error?.message || result.error, 'error');
  }
}

// 显示创建日历模态框
function showCreateCalendarModal() {
  document.getElementById('create-calendar-modal').classList.add('active');
  document.getElementById('calendar-name').focus();
}

// 关闭创建日历模态框
function closeCreateCalendarModal() {
  document.getElementById('create-calendar-modal').classList.remove('active');
  document.getElementById('calendar-name').value = '';
  document.getElementById('calendar-description').value = '';
  document.getElementById('calendar-public').checked = false;
}

// 创建日历
async function createCalendar() {
  const name = document.getElementById('calendar-name').value.trim();
  const description = document.getElementById('calendar-description').value.trim();
  const isPublic = document.getElementById('calendar-public').checked;
  
  if (!name) {
    showMessage('calendar-message', '请输入日历名称', 'error');
    return;
  }
  
  const result = await createCalendarApi(name, description || null, isPublic);
  
  if (result.success) {
    showMessage('calendar-message', '日历创建成功', 'success');
    closeCreateCalendarModal();
    loadCalendars();
  } else {
    showMessage('calendar-message', result.error?.message || result.error, 'error');
  }
}

// 确认删除日历
function confirmDeleteCalendar(calendarId) {
  if (!confirm('确定要删除这个日历吗？此操作不可恢复，日历中的所有日程也将被删除。')) return;
  
  deleteCalendarApi(calendarId).then(result => {
    if (result.success) {
      showMessage('calendar-message', '日历已删除', 'success');
      loadCalendars();
    } else {
      showMessage('calendar-message', result.error?.message || result.error, 'error');
    }
  });
}

// 显示订阅模态框
function showSubscribeModal(calendarId) {
  const baseUrl = window.location.origin;
  const subscribeUrl = `${baseUrl}/api/calendars/${calendarId}/ical`;
  document.getElementById('subscribe-url').value = subscribeUrl;
  document.getElementById('subscribe-modal').classList.add('active');
}

// 关闭订阅模态框
function closeSubscribeModal() {
  document.getElementById('subscribe-modal').classList.remove('active');
}

// 复制订阅链接
function copySubscribeUrl() {
  const urlInput = document.getElementById('subscribe-url');
  urlInput.select();
  document.execCommand('copy');
  showMessage('calendar-message', '订阅链接已复制', 'success');
}

// 开始编辑日历名称
function startEditCalendarName(calendarId, currentName) {
  const nameSpan = document.getElementById(`calendar-name-${calendarId}`);
  if (!nameSpan) return;
  
  if (nameSpan.querySelector('input')) return;
  
  const wrapper = nameSpan.parentElement;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName || '';
  input.className = 'calendar-name-input';
  input.placeholder = '输入日历名称';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-icon btn-icon-success';
  saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  saveBtn.title = '保存';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-icon btn-icon-secondary';
  cancelBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
  cancelBtn.title = '取消';
  
  const doSave = () => {
    const newName = input.value.trim();
    if (newName === currentName) {
      cancelEdit();
      return;
    }
    
    updateCalendarName(calendarId, newName).then(result => {
      if (result.success) {
        showMessage('calendar-message', '名称已更新', 'success');
        loadCalendars();
      } else {
        showMessage('calendar-message', result.error, 'error');
        cancelEdit();
      }
    });
  };
  
  const cancelEdit = () => {
    loadCalendars();
  };
  
  saveBtn.onclick = doSave;
  cancelBtn.onclick = cancelEdit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') cancelEdit();
  };
  
  nameSpan.style.display = 'none';
  wrapper.insertBefore(input, nameSpan);
  wrapper.insertBefore(saveBtn, nameSpan);
  wrapper.insertBefore(cancelBtn, nameSpan);
  
  input.focus();
  input.select();
}

// 更新日历名称
async function updateCalendarName(calendarId, name) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch(`/api/calendars/${calendarId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || '更新失败' };
    }
  } catch (error) {
    return { success: false, error: '网络错误' };
  }
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '未知';
  // 修复日期解析问题
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'T12:00:00');
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 切换日历选择状态
function toggleCalendarSelection(calendarId, checked) {
  if (checked) {
    selectedCalendarIds.add(calendarId);
  } else {
    selectedCalendarIds.delete(calendarId);
  }
  updateBatchActions();
}

// 更新批量操作界面
function updateBatchActions() {
  const batchActions = document.getElementById('batchActions');
  const selectedCount = document.getElementById('selectedCount');
  
  if (selectedCalendarIds.size > 0) {
    batchActions.classList.remove('hidden');
    selectedCount.textContent = `已选择 ${selectedCalendarIds.size} 个日历`;
  } else {
    batchActions.classList.add('hidden');
  }
}

// 清除选择
function clearSelection() {
  selectedCalendarIds.clear();
  updateBatchActions();
  renderCalendarList(filteredCalendars);
}

// 切换视图
function switchView(view) {
  if (currentView === view) return;
  
  currentView = view;
  
  // 更新按钮状态
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // 更新列表样式
  const calendarList = document.getElementById('calendar-list');
  if (calendarList) {
    calendarList.className = `calendar-list ${view}-view`;
  }
  
  // 重新渲染日历列表
  renderCalendarList(filteredCalendars);
}

// 渲染网格视图的日历项
function renderCalendarGridItem(calendar) {
  const isSelected = selectedCalendarIds.has(calendar.id);
  
  return `
  <div class="calendar-item ${isSelected ? 'selected' : ''}" data-calendar-id="${calendar.id}">
    <div class="calendar-header">
      <div class="calendar-name-wrapper">
        <div class="calendar-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCalendarSelection('${calendar.id}', this.checked)">
        </div>
        <span class="calendar-name" onclick="startEditCalendarName('${calendar.id}', '${escapeHtml(calendar.name)}')">${escapeHtml(calendar.name)}</span>
      </div>
      ${calendar.isPublic ? '<span class="calendar-badge public">公开</span>' : '<span class="calendar-badge private">私有</span>'}
    </div>
    
    ${calendar.description ? `<p class="calendar-description">${escapeHtml(calendar.description)}</p>` : ''}
    
    <div class="calendar-meta">
      <span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
        </svg>
        创建: ${formatDate(calendar.createdAt)}
      </span>
      <span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
        ${calendar.eventCount || 0} 个日程
      </span>
    </div>
    
    <div class="calendar-actions">
      <a href="/events.html?calendar=${calendar.id}" class="btn btn-sm btn-secondary">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
        </svg>
        管理日程
      </a>
      ${calendar.isPublic ? `
      <button class="btn btn-sm btn-secondary" onclick="showSubscribeModal('${calendar.id}')">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/>
          <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"/>
        </svg>
        订阅链接
      </button>
      ` : ''}
      <button class="btn btn-sm btn-danger" onclick="confirmDeleteCalendar('${calendar.id}')">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        删除
      </button>
    </div>
  </div>
  `;
}

// 删除选中的日历
async function deleteSelectedCalendars() {
  if (selectedCalendarIds.size === 0) return;
  
  const calendarNames = calendars
    .filter(calendar => selectedCalendarIds.has(calendar.id))
    .map(calendar => calendar.name);
  
  if (!confirm(`确定要删除以下 ${selectedCalendarIds.size} 个日历吗？\n\n${calendarNames.join('\n')}\n\n此操作不可恢复，日历中的所有日程也将被删除。`)) {
    return;
  }
  
  const deletePromises = Array.from(selectedCalendarIds).map(calendarId => 
    deleteCalendarApi(calendarId)
  );
  
  try {
    const results = await Promise.all(deletePromises);
    const failedCount = results.filter(result => !result.success).length;
    
    if (failedCount === 0) {
      showMessage('calendar-message', `成功删除 ${selectedCalendarIds.size} 个日历`, 'success');
    } else {
      showMessage('calendar-message', `成功删除 ${selectedCalendarIds.size - failedCount} 个日历，${failedCount} 个删除失败`, 'warning');
    }
    
    selectedCalendarIds.clear();
    updateBatchActions();
    loadCalendars();
  } catch (error) {
    showMessage('calendar-message', '批量删除失败: ' + error.message, 'error');
  }
}

// 搜索日历
function searchCalendars() {
  const searchTerm = document.getElementById('calendarSearch').value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredCalendars = calendars;
  } else {
    filteredCalendars = calendars.filter(calendar => 
      calendar.name.toLowerCase().includes(searchTerm) ||
      (calendar.description && calendar.description.toLowerCase().includes(searchTerm))
    );
  }
  
  renderCalendarList(filteredCalendars);
}

// 页面加载时获取日历列表
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initNavbar();
  loadCalendars();
  
  // 添加搜索框事件监听
  const searchInput = document.getElementById('calendarSearch');
  if (searchInput) {
    searchInput.addEventListener('input', searchCalendars);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchCalendars();
      }
    });
  }
});
