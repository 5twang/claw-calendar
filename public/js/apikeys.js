// Claw-Calendar - API Key 管理功能

// 获取 API Key 列表
async function getApiKeys() {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch('/api/keys', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, keys: data.keys || [] };
    } else {
      return { success: false, error: data.error || '获取 API Key 失败' };
    }
  } catch (error) {
    console.error('获取 API Key 失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 创建 API Key
async function createApiKey(name, expiresInDays = null) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const body = { name };
    if (expiresInDays) {
      body.expiresInDays = parseInt(expiresInDays);
    }
    
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, key: data };
    } else {
      return { success: false, error: data.error || '创建 API Key 失败' };
    }
  } catch (error) {
    console.error('创建 API Key 失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 更新 API Key
async function updateApiKey(keyId, updates) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch(`/api/keys/${keyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, key: data.key };
    } else {
      return { success: false, error: data.error || '更新 API Key 失败' };
    }
  } catch (error) {
    console.error('更新 API Key 失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 删除 API Key
async function deleteApiKey(keyId) {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  
  try {
    const response = await fetch(`/api/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, message: data.message };
    } else {
      return { success: false, error: data.error || '删除 API Key 失败' };
    }
  } catch (error) {
    console.error('删除 API Key 失败:', error);
    return { success: false, error: '网络错误' };
  }
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '从未';
  // 修复日期解析问题
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'T12:00:00');
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 格式化相对时间
function formatRelativeTime(dateString) {
  if (!dateString) return '从未使用';
  
  // 修复日期解析问题
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'T12:00:00');
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  
  return formatDate(dateString);
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}

// 渲染 API Key 列表
async function renderApiKeyList() {
  const container = document.getElementById('apikey-list');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner"></span> 加载中...</div>';
  
  const result = await getApiKeys();
  
  if (!result.success) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <h3>加载失败</h3>
        <p>${result.error?.message || result.error || '未知错误'}</p>
      </div>
    `;
    return;
  }
  
  const keys = result.keys;
  
  if (keys.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"/>
        </svg>
        <h3>暂无 API Key</h3>
        <p>点击上方按钮创建你的第一个 API Key</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = keys.map(key => `
    <div class="apikey-item ${key.isActive ? '' : 'inactive'}" data-key-id="${key.id}">
      <div class="apikey-header">
        <div class="apikey-name-wrapper">
          <span class="apikey-name" id="key-name-${key.id}" onclick="startEditKeyName('${key.id}', '${escapeHtml(key.name || '')}')">${escapeHtml(key.name || '未命名密钥')}</span>
          <button class="btn-icon" onclick="startEditKeyName('${key.id}', '${escapeHtml(key.name || '')}')" title="修改名称">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
        </div>
        <span class="apikey-badge ${key.isActive ? 'active' : 'inactive'}">
          ${key.isActive ? '启用中' : '已禁用'}
        </span>
      </div>
      
      <div class="apikey-value">
        <span>${key.prefix}****************************</span>
      </div>
      
      <div class="apikey-meta">
        <span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
          </svg>
          创建: ${formatDate(key.createdAt)}
        </span>
        <span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd"/>
          </svg>
          最后使用: ${formatRelativeTime(key.lastUsedAt)}
        </span>
        ${key.expiresAt ? `
        <span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
          </svg>
          过期: ${formatDate(key.expiresAt)}
        </span>
        ` : ''}
      </div>
      
      <div class="apikey-actions">
        <button class="btn btn-sm ${key.isActive ? 'btn-outline' : 'btn-success'}" onclick="toggleApiKey('${key.id}', ${!key.isActive})">
          ${key.isActive ? '禁用' : '启用'}
        </button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteApiKey('${key.id}')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          删除
        </button>
      </div>
    </div>
  `).join('');
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示无法复制提示（用于列表中的 key）
function showCannotCopyMessage() {
  showMessage('apikey-message', '出于安全考虑，API Key 仅在创建时显示一次。如需查看，请删除此密钥并创建新的。', 'warning');
}

// 复制 API Key（从存储中获取）
async function copyApiKey(keyId) {
  // 只有刚创建的 key 会存储在内存中，其他的无法复制
  const keyData = window._newApiKey;
  if (keyData && keyData.id === keyId) {
    const success = await copyToClipboard(keyData.fullKey);
    if (success) {
      showMessage('apikey-message', 'API Key 已复制到剪贴板', 'success');
    } else {
      showMessage('apikey-message', '复制失败，请手动复制', 'error');
    }
  } else {
    showCannotCopyMessage();
  }
}

// 开始编辑 API Key 名称
function startEditKeyName(keyId, currentName) {
  const nameSpan = document.getElementById(`key-name-${keyId}`);
  if (!nameSpan) return;
  
  // 如果已经在编辑中，不重复处理
  if (nameSpan.querySelector('input')) return;
  
  const wrapper = nameSpan.parentElement;
  
  // 创建输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName || '';
  input.className = 'key-name-input';
  input.placeholder = '输入名称';
  
  // 创建保存按钮
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-icon btn-icon-success';
  saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  saveBtn.title = '保存';
  
  // 创建取消按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-icon btn-icon-secondary';
  cancelBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
  cancelBtn.title = '取消';
  
  // 保存处理
  const doSave = () => {
    const newName = input.value.trim();
    if (newName === currentName) {
      cancelEdit();
      return;
    }
    
    updateApiKey(keyId, { name: newName || null }).then(result => {
      if (result.success) {
        showMessage('apikey-message', '名称已更新', 'success');
        renderApiKeyList();
      } else {
        showMessage('apikey-message', result.error?.message || result.error, 'error');
        cancelEdit();
      }
    });
  };
  
  // 取消处理
  const cancelEdit = () => {
    renderApiKeyList();
  };
  
  // 绑定事件
  saveBtn.onclick = doSave;
  cancelBtn.onclick = cancelEdit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') cancelEdit();
  };
  input.onblur = () => {
    // 延迟处理，让按钮点击事件先触发
    setTimeout(() => {
      if (document.activeElement !== input && document.activeElement !== saveBtn) {
        cancelEdit();
      }
    }, 200);
  };
  
  // 替换内容
  nameSpan.style.display = 'none';
  wrapper.insertBefore(input, nameSpan);
  wrapper.insertBefore(saveBtn, nameSpan);
  wrapper.insertBefore(cancelBtn, nameSpan);
  
  // 聚焦并选中文本
  input.focus();
  input.select();
}

// 编辑 API Key（旧版，保留兼容）
function editApiKey(keyId, currentName) {
  startEditKeyName(keyId, currentName);
}

// 切换 API Key 状态
function toggleApiKey(keyId, isActive) {
  const action = isActive ? '启用' : '禁用';
  if (!confirm(`确定要${action}这个 API Key 吗？`)) return;
  
  updateApiKey(keyId, { isActive }).then(result => {
    if (result.success) {
      showMessage('apikey-message', `API Key 已${action}`, 'success');
      renderApiKeyList();
    } else {
      showMessage('apikey-message', result.error, 'error');
    }
  });
}

// 确认删除 API Key
function confirmDeleteApiKey(keyId) {
  if (!confirm('确定要删除这个 API Key 吗？此操作不可恢复，使用此密钥的应用将立即失效。')) return;
  
  deleteApiKey(keyId).then(result => {
    if (result.success) {
      showMessage('apikey-message', 'API Key 已删除', 'success');
      renderApiKeyList();
    } else {
      showMessage('apikey-message', result.error, 'error');
    }
  });
}

// 显示创建 API Key 模态框
function showCreateApiKeyModal() {
  document.getElementById('create-apikey-modal').classList.add('active');
  document.getElementById('new-key-name').focus();
}

// 关闭创建 API Key 模态框
function closeCreateApiKeyModal() {
  document.getElementById('create-apikey-modal').classList.remove('active');
  document.getElementById('create-apikey-form').reset();
  document.getElementById('new-key-result').classList.add('hidden');
}

// 显示新创建的 API Key
function showNewApiKey(keyData) {
  // 后端返回结构: { apiKey: '完整密钥', key: { id, name, ... } }
  const fullApiKey = keyData.apiKey;
  const keyInfo = keyData.key;
  
  const resultDiv = document.getElementById('new-key-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = `
    <div class="alert alert-warning">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span><strong>请立即复制保存！</strong> API Key 只会在此时显示一次，之后无法再次查看。</span>
    </div>
    <div class="apikey-value" style="margin-top: 16px;">
      <span id="new-key-full">${fullApiKey}</span>
      <button class="btn btn-sm btn-success" onclick="copyNewApiKey()">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
        </svg>
        复制
      </button>
    </div>
  `;
  
  // 存储新 key 以便后续复制
  window._newApiKey = {
    id: keyInfo.id,
    fullKey: fullApiKey
  };
}

// 复制新创建的 API Key
async function copyNewApiKey() {
  const keyText = document.getElementById('new-key-full').textContent;
  const success = await copyToClipboard(keyText);
  if (success) {
    showMessage('apikey-message', 'API Key 已复制到剪贴板', 'success');
  }
}
