// Claw-Calendar - 认证相关功能

const API_BASE_URL = '';

// 移动端导航栏切换
function toggleNavbar() {
  const navbarNav = document.getElementById('navbar-nav');
  if (navbarNav) {
    navbarNav.classList.toggle('active');
  }
}

// 点击页面其他地方关闭导航栏
document.addEventListener('click', (e) => {
  const navbar = document.querySelector('.navbar');
  const navbarNav = document.getElementById('navbar-nav');
  if (navbar && navbarNav && !navbar.contains(e.target)) {
    navbarNav.classList.remove('active');
  }
});

// 存储 token
function setToken(token) {
  localStorage.setItem('token', token);
}

function getToken() {
  return localStorage.getItem('token');
}

function removeToken() {
  localStorage.removeItem('token');
}

// 检查是否已登录
function isLoggedIn() {
  return !!getToken();
}

// 获取当前用户信息
async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user;
    } else {
      removeToken();
      return null;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

// 登录
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    } else {
      // 提取错误信息（后端返回 { error: { message, code } }）
      let errorMsg = (data.error && data.error.message) || data.error || '登录失败';
      // 针对 429 错误（速率限制）保持原错误信息
      return { success: false, error: errorMsg };
    }
  } catch (e) {
    console.error('登录请求失败:', e);
    return { success: false, error: '无法连接服务器，请检查网络' };
  }
}

// 注册
async function register(email, password, name) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const data = await response.json();
    if (response.ok) {
      // 检查是否需要邮箱验证
      if (data.requireVerification) {
        // 不保存 token，返回需要验证的标记
        return { success: true, requireVerification: true, user: data.user };
      }
      // 不需要验证的情况（正常返回 token）
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    } else {
      // 提取错误信息（后端返回 { error: { message, code } }）
      let errorMsg = (data.error && data.error.message) || data.error || '注册失败';
      // 针对 409 错误添加更友好的提示
      if (response.status === 409) {
        errorMsg = '该邮箱已被注册，请直接登录或使用找回密码功能';
      }
      // 针对 429 错误（速率限制）保持原错误信息
      return { success: false, error: errorMsg };
    }
  } catch (e) {
    console.error('注册请求失败:', e);
    return { success: false, error: '无法连接服务器，请检查网络' };
  }
}

// 登出
async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('登出请求失败:', error);
    }
  }
  removeToken();
  window.location.href = '/login.html';
}

// 修改密码
async function changePassword(currentPassword, newPassword) {
  const token = getToken();
  if (!token) {
    return { success: false, error: '未登录' };
  }
  
  const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    return { success: true, message: data.message };
  } else {
    // 提取错误信息（后端返回 { error: { message, code } }）
    const errorMsg = (data.error && data.error.message) || data.error || '修改密码失败';
    return { success: false, error: errorMsg };
  }
}

// 检查登录状态并跳转
async function checkAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

// 如果已登录则跳转到首页
async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = '/dashboard.html';
    return true;
  }
  return false;
}

// HTML 转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示消息（兼容旧版，建议使用 Toast）
function showMessage(elementId, message, type = 'error') {
  const element = document.getElementById(elementId);
  if (!element) {
    // 如果元素不存在，使用 Toast
    showMsg(message, type);
    return;
  }

  element.className = `alert alert-${type}`;
  element.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      ${type === 'success'
        ? '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>'
      }
    </svg>
    <span></span>
  `;
  element.querySelector('span').textContent = message;
  element.classList.remove('hidden');

  // 5秒后自动隐藏
  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}

// Toast 通知
function showMsg(msg, type = 'success') {
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
    <span></span>
  `;
  toast.querySelector('span').textContent = msg;

  container.appendChild(toast);

  // 4秒后自动移除
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 显示/隐藏加载状态
function setLoading(buttonId, loading) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  button.disabled = loading;
  const originalText = button.dataset.originalText || button.innerHTML;
  
  if (loading) {
    button.dataset.originalText = originalText;
    button.innerHTML = '<span class="spinner"></span> 处理中...';
  } else {
    button.innerHTML = originalText;
  }
}

// 通用 API 请求封装（带认证）
async function apiFetch(url, opts = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE_URL}${url}`, {
    ...opts,
    headers
  });
}

// ─── 公共导航栏初始化 ─────────────────────────────────────────

/**
 * 初始化导航栏：根据当前 URL 自动高亮对应菜单项
 * 各页面只需在 DOMContentLoaded 中调用此函数即可
 */
function initNavbar() {
  // 获取当前页面路径
  const currentPath = window.location.pathname;
  
  // 导航链接映射：路径 -> 菜单标识
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // 转换为绝对路径（处理相对路径）
    let linkPath = href;
    if (!href.startsWith('/') && !href.startsWith('http')) {
      // 相对路径，需要解析
      const base = window.location.pathname.replace(/[^/]*$/, '');
      linkPath = base + href;
    }
    
    // 移除已有的 active 类
    link.classList.remove('active');
    
    // 精确匹配或前缀匹配
    const isActive = currentPath === linkPath || 
                     (href === '/dashboard.html' && (currentPath === '/' || currentPath.endsWith('dashboard.html')));
    
    if (isActive) {
      link.classList.add('active');
    }
  });
}
