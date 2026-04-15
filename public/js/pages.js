// Claw-Calendar - 各页面专用脚本

// ==================== Toast 通知（跨页面通用） ====================

function showMsg(msg, type = 'success') {
  // 使用页面内的消息提示区域（如果有）
  const msgArea = document.querySelector('.alert:not(.hidden)');
  if (msgArea) {
    msgArea.className = `alert alert-${type}`;
    msgArea.textContent = msg;
    msgArea.classList.remove('hidden');
    setTimeout(() => msgArea.classList.add('hidden'), 5000);
    return;
  }
  
  // 使用 Toast 通知
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
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== 邮箱验证页面 ====================

async function verifyEmail() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showVerifyError('缺少验证令牌');
    return;
  }

  try {
    const response = await fetch(`/api/auth/verify-email?token=${token}`);
    const data = await response.json();

    if (data.success) {
      showVerifySuccess('邮箱验证成功！', '您的账户已激活，现在可以登录使用了。');
    } else {
      showVerifyError(data.error || '验证失败');
    }
  } catch (error) {
    showVerifyError('网络错误，请稍后重试');
  }
}

function showVerifySuccess(title, message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('result').style.display = 'block';

  document.getElementById('result-icon').innerHTML = `
    <div class="verify-icon success">
      <svg viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </div>
  `;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-message').innerHTML = `<p>${message}</p>`;
  document.getElementById('result-btn').textContent = '前往登录';
}

function showVerifyError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('result').style.display = 'block';

  document.getElementById('result-icon').innerHTML = `
    <div class="verify-icon error">
      <svg viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </div>
  `;
  document.getElementById('result-title').textContent = '验证失败';
  document.getElementById('result-message').innerHTML = `<div class="error-message">${message}</div>`;
  document.getElementById('result-btn').textContent = '返回注册';
  document.getElementById('result-btn').href = '/register.html';
}

// 页面加载时自动验证（仅在 verify-email 页面）
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loading')) {
    verifyEmail();
  }
});

// ==================== 个人设置页面 ====================

async function loadProfile() {
  const currentUser = await checkAuth();
  if (!currentUser) return;

  document.getElementById('profile-email').value = currentUser.email;
  document.getElementById('profile-name').value = currentUser.name || '';

  if (currentUser.createdAt) {
    // 后端返回的 createdAt 已经是 ISO 格式，直接使用
    document.getElementById('profile-created').value = new Date(currentUser.createdAt).toLocaleString('zh-CN');
  }
}

function initProfilePage() {
  // 仅在 profile 页面执行
  if (!document.getElementById('profile-email')) return;

  loadProfile();

  // 修改密码表单
  const form = document.getElementById('change-password-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-new-password').value;

      if (newPassword.length < 8) {
        showMsg('新密码长度至少8位', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showMsg('两次输入的新密码不一致', 'error');
        return;
      }

      setLoading('password-btn', true);

      const result = await changePassword(currentPassword, newPassword);

      setLoading('password-btn', false);

      if (result.success) {
        showMsg(result.message + '，请重新登录', 'success');
        document.getElementById('change-password-form').reset();

        // 3秒后登出
        setTimeout(() => {
          logout();
        }, 3000);
      } else {
        showMsg(result.error?.message || result.error, 'error');
      }
    });
  }

  // 实时验证密码匹配
  const confirmInput = document.getElementById('confirm-new-password');
  if (confirmInput) {
    confirmInput.addEventListener('input', (e) => {
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = e.target.value;

      if (confirmPassword && newPassword !== confirmPassword) {
        e.target.classList.add('error');
      } else {
        e.target.classList.remove('error');
      }
    });
  }
}

// 保存姓名
async function saveProfileName() {
  const btn = document.getElementById('save-name-btn');
  const nameInput = document.getElementById('profile-name');
  const name = nameInput.value.trim();

  if (btn) {
    btn.disabled = true;
    btn.textContent = '保存中...';
  }

  try {
    const response = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name })
    });

    const data = await response.json();

    if (data.success) {
      showMsg('姓名更新成功', 'success');
      // 更新本地存储的用户信息
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.name = data.user.name;
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      showMsg(data.error || '更新失败', 'error');
    }
  } catch (error) {
    showMsg('网络错误，请稍后重试', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '保存姓名';
    }
  }
}

// ==================== 控制台页面 ====================

async function loadUserInfo() {
  const user = await checkAuth();
  if (!user) return;

  // 显示用户信息
  document.getElementById('user-name').textContent = user.name || '未设置姓名';
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = (user.name || user.email).charAt(0).toUpperCase();

  // 统计信息 - 从 API 获取真实日历数量
  const calRes = await apiFetch('/api/calendars');
  if (calRes.ok) {
    const calData = await calRes.json();
    document.getElementById('calendar-count').textContent = calData.calendars ? calData.calendars.length : 0;
  } else {
    document.getElementById('calendar-count').textContent = 0;
  }

  // 注册时间 - 后端返回 createdAt (驼峰命名)
  const createdAt = user.createdAt || user.created_at;
  if (createdAt) {
    const date = new Date(createdAt);
    document.getElementById('account-date').textContent = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
  } else {
    document.getElementById('account-date').textContent = '-';
  }

  // 获取 API Key 数量
  try {
    const keysResult = await getApiKeys();
    if (keysResult.success && keysResult.keys) {
      document.getElementById('apikey-count').textContent = keysResult.keys.length;
    } else {
      document.getElementById('apikey-count').textContent = '0';
    }
  } catch (e) {
    console.error('获取 API Key 数量失败:', e);
    document.getElementById('apikey-count').textContent = '0';
  }
}

function initDashboardPage() {
  // 仅在 dashboard 页面执行
  if (!document.getElementById('user-name')) return;
  loadUserInfo();
}

// ==================== API Keys 页面 ====================

function initApiKeysPage() {
  // 仅在 apikeys 页面执行
  if (!document.getElementById('apikey-list')) return;

  // 检查登录状态
  checkAuth().then(user => {
    if (user) {
      renderApiKeyList();
    }
  });
}

async function submitCreateApiKey() {
  const name = document.getElementById('new-key-name').value.trim();
  const expiresInDays = document.getElementById('new-key-expiry').value;

  const btn = document.getElementById('create-key-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 创建中...';

  const result = await createApiKey(name || null, expiresInDays || null);

  btn.disabled = false;
  btn.innerHTML = '创建';

  if (result.success) {
    showNewApiKey(result.key);
    renderApiKeyList();
  } else {
    showMsg(result.error, 'error');
  }
}

// ==================== 页面初始化调度器 ====================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initProfilePage();
  initDashboardPage();
  initApiKeysPage();
});
