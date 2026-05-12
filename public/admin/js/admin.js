// Claw Calendar Admin Panel — 登录 + 用户管理
(function () {
  'use strict';

  const API_BASE = '';

  // ====== State ======
  let currentUser = null;
  let usersCache = [];
  let totalUsers = 0;
  let currentPage = 1;
  let currentLimit = 20;
  let totalPages = 1;
  let isLoading = false;

  // ====== DOM refs ======
  const $ = (id) => document.getElementById(id);

  const loginSection = $('login-section');
  const dashboardSection = $('dashboard-section');
  const loginForm = $('login-form');
  const loginEmail = $('login-email');
  const loginPassword = $('login-password');
  const loginBtn = $('login-btn');
  const loginError = $('login-error');
  const logoutBtn = $('logout-btn');
  const headerAdminInfo = $('header-admin-info');

  const statTotal = $('stat-total');
  const statActive = $('stat-active');
  const statAdmins = $('stat-admins');
  const statInactive = $('stat-inactive');

  const searchInput = $('search-input');
  const statusFilter = $('status-filter');
  const adminFilter = $('admin-filter');
  const searchBtn = $('search-btn');

  const userTbody = $('user-tbody');
  const tableLoading = $('table-loading');
  const tableEmpty = $('table-empty');
  const tableCount = $('table-count');

  const paginationBar = $('pagination');
  const paginationInfo = $('pagination-info');
  const paginationCurrent = $('pagination-current');
  const prevPageBtn = $('prev-page-btn');
  const nextPageBtn = $('next-page-btn');

  const modalOverlay = $('user-detail-modal');
  const modalBody = $('modal-body');
  const modalCloseBtn = $('modal-close-btn');

  const toastContainer = $('toast-container');

  // ====== Token helpers ======
  function getToken() { return localStorage.getItem('admin_token'); }
  function setToken(t) { localStorage.setItem('admin_token', t); }
  function removeToken() { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); }

  // ====== Toast ======
  function showToast(msg, type) {
    type = type || 'success';
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span></span>';
    el.querySelector('span').textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(function () {
      el.classList.add('hide');
      setTimeout(function () { el.remove(); }, 300);
    }, 4000);
  }

  // ====== API fetch ======
  async function apiFetch(url, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (opts.headers) {
      Object.assign(headers, opts.headers);
    }
    try {
      var res = await fetch(API_BASE + url, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body || undefined
      });
      if (res.status === 401) {
        removeToken();
        showToast('登录已过期，请重新登录', 'error');
        showLogin();
        return null;
      }
      var data = await res.json();
      if (!res.ok) {
        var errMsg = data.message || data.error || '请求失败';
        if (res.status === 403) {
          errMsg = data.message || '权限不足';
        }
        return { error: true, message: errMsg, status: res.status };
      }
      return data;
    } catch (e) {
      console.error('API请求失败:', e);
      return { error: true, message: '无法连接服务器，请检查网络' };
    }
  }

  // ====== View switching ======
  function showLogin() {
    loginSection.style.display = '';
    dashboardSection.style.display = 'none';
    loginForm.reset();
    loginError.classList.add('hidden');
  }

  function showDashboard(user) {
    currentUser = user;
    loginSection.style.display = 'none';
    dashboardSection.style.display = '';
    headerAdminInfo.textContent = user.email;
    loadUsers();
  }

  // ====== Login ======
  async function handleLogin(e) {
    e.preventDefault();
    var email = loginEmail.value.trim();
    var password = loginPassword.value;
    if (!email || !password) {
      showLoginError('请填写邮箱和密码');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    loginError.classList.add('hidden');

    var res = await apiFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password })
    });

    loginBtn.disabled = false;
    loginBtn.textContent = '登录';

    if (!res || res.error) {
      var msg = (res && res.message) || '登录失败';
      showLoginError(msg);
      return;
    }

    if (res.token && res.user) {
      setToken(res.token);
      localStorage.setItem('admin_user', JSON.stringify(res.user));
      showDashboard(res.user);
      showToast('登录成功', 'success');
    } else {
      showLoginError('登录响应格式错误');
    }
  }

  function showLoginError(msg) {
    loginError.querySelector('span').textContent = msg;
    loginError.classList.remove('hidden');
  }

  // ====== Logout ======
  async function handleLogout() {
    removeToken();
    showToast('已安全登出', 'info');
    showLogin();
  }

  // ====== Load users ======
  async function loadUsers() {
    if (isLoading) return;
    isLoading = true;
    tableLoading.classList.remove('hidden');
    tableEmpty.classList.add('hidden');
    userTbody.innerHTML = '';
    paginationBar.classList.add('hidden');

    var search = searchInput.value.trim();
    var status = statusFilter.value;
    var isAdmin = adminFilter.checked ? 'true' : '';

    var params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', currentLimit);
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    if (isAdmin) params.set('is_admin', isAdmin);

    var res = await apiFetch('/api/admin/users?' + params.toString());

    isLoading = false;
    tableLoading.classList.add('hidden');

    if (!res || res.error) {
      var msg = (res && res.message) || '获取用户列表失败';
      showToast(msg, 'error');
      userTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);">加载失败</td></tr>';
      return;
    }

    var users = res.users || [];
    totalUsers = res.total || users.length;
    totalPages = Math.max(1, Math.ceil(totalUsers / currentLimit));

    usersCache = users;

    if (users.length === 0) {
      tableEmpty.classList.remove('hidden');
      userTbody.innerHTML = '';
      paginationBar.classList.add('hidden');
    } else {
      tableEmpty.classList.add('hidden');
      renderUsers(users);
      renderPagination();
    }

    updateStats();
  }

  // ====== Render users ======
  function renderUsers(users) {
    var html = '';
    users.forEach(function (u) {
      var statusClass = u.is_active ? 'badge-active' : 'badge-inactive';
      var statusText = u.is_active ? '活跃' : '未激活';
      var roleClass = u.is_admin ? 'badge-admin' : 'badge-user';
      var roleText = u.is_admin ? '管理员' : '用户';
      var created = formatDate(u.created_at);
      var actionBtn = '<div class="action-group">';
      if (u.is_active) {
        actionBtn += '<button class="btn btn-sm btn-xs btn-danger btn-toggle" data-id="' + u.id + '" data-action="disable">禁用</button>';
      } else {
        actionBtn += '<button class="btn btn-sm btn-xs btn-success btn-toggle" data-id="' + u.id + '" data-action="enable">启用</button>';
      }
      actionBtn += '<button class="btn btn-sm btn-xs btn-danger btn-delete" data-id="' + u.id + '" style="margin-left:4px;">删除</button>';
      actionBtn += '</div>';

      html += '<tr>' +
        '<td><span class="cell-link" data-id="' + u.id + '">' + esc(u.email) + '</span></td>' +
        '<td>' + esc(u.name || '-') + '</td>' +
        '<td><span class="badge ' + statusClass + '"><span class="badge-dot"></span>' + statusText + '</span></td>' +
        '<td><span class="badge ' + roleClass + '">' + roleText + '</span></td>' +
        '<td>' + u.calendar_count + '</td>' +
        '<td>' + u.event_count + '</td>' +
        '<td>' + created + '</td>' +
        '<td>' + actionBtn + '</td>' +
        '</tr>';
    });
    userTbody.innerHTML = html;
    tableCount.textContent = '共 ' + totalUsers + ' 条';
  }

  // ====== Pagination ======
  function renderPagination() {
    paginationBar.classList.remove('hidden');
    paginationInfo.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页，共 ' + totalUsers + ' 条';
    paginationCurrent.textContent = '第 ' + currentPage + ' 页';
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  function goToPrevPage() {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  }

  function goToNextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  }

  // ====== Stats ======
  function updateStats() {
    var total = totalUsers;
    var active = 0;
    var admins = 0;
    var inactive = 0;
    usersCache.forEach(function (u) {
      if (u.is_active) active++;
      else inactive++;
      if (u.is_admin) admins++;
    });
    statTotal.textContent = total;
    statActive.textContent = active;
    statAdmins.textContent = admins;
    statInactive.textContent = inactive;
  }

  // ====== User detail modal ======
  async function openUserDetail(userId) {
    modalBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);"><div class="spinner"></div><p style="margin-top:12px;">加载中...</p></div>';
    modalOverlay.style.display = '';

    var res = await apiFetch('/api/admin/users/' + encodeURIComponent(userId));
    if (!res || res.error) {
      modalBody.innerHTML = '<p style="text-align:center;padding:40px;color:var(--gray-400);">加载失败</p>';
      return;
    }

    var u = res.user;
    var statusClass = u.is_active ? 'badge-active' : 'badge-inactive';
    var statusText = u.is_active ? '活跃' : '未激活';
    var roleText = u.is_admin ? '管理员' : '用户';

    modalBody.innerHTML =
      '<div class="detail-grid">' +
        '<div class="detail-row"><span class="detail-label">邮箱</span><span class="detail-value">' + esc(u.email) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">姓名</span><span class="detail-value">' + esc(u.name || '-') + '</span></div>' +
        '<div class="detail-divider"></div>' +
        '<div class="detail-row"><span class="detail-label">状态</span><span class="detail-value"><span class="badge ' + statusClass + '"><span class="badge-dot"></span>' + statusText + '</span></span></div>' +
        '<div class="detail-row"><span class="detail-label">角色</span><span class="detail-value">' + roleText + '</span></div>' +
        '<div class="detail-divider"></div>' +
        '<div class="detail-row"><span class="detail-label">日历数</span><span class="detail-value">' + u.calendar_count + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">事件数</span><span class="detail-value">' + u.event_count + '</span></div>' +
        '<div class="detail-divider"></div>' +
        '<div class="detail-row"><span class="detail-label">注册时间</span><span class="detail-value">' + formatDate(u.created_at) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">更新时间</span><span class="detail-value">' + formatDate(u.updated_at) + '</span></div>' +
      '</div>';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

  // ====== Toggle user active state ======
  async function handleToggleUser(userId, action) {
    var isActive = action === 'enable';
    var actionText = isActive ? '启用' : '禁用';
    var confirmMsg = '确定要' + actionText + '该用户吗？';

    if (!confirm(confirmMsg)) return;

    var res = await apiFetch('/api/admin/users/' + encodeURIComponent(userId), {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    });

    if (!res || res.error) {
      showToast((res && res.message) || '操作失败', 'error');
      return;
    }

    showToast('用户已' + actionText, 'success');
    loadUsers();
  }

  // ====== Delete user ======
  async function handleDeleteUser(userId) {
    if (!confirm('确定要删除该用户吗？此操作不可恢复（将同时删除该用户的所有日历、事件和API密钥）。')) return;

    if (!confirm('再次确认：彻底删除用户及其所有数据？')) return;

    var res = await apiFetch('/api/admin/users/' + encodeURIComponent(userId), {
      method: 'DELETE'
    });

    if (!res || res.error) {
      showToast((res && res.message) || '删除失败', 'error');
      return;
    }

    showToast('用户已彻底删除', 'success');
    loadUsers();
  }

  // ====== Event delegation ======
  function handleTableClick(e) {
    var target = e.target;

    // Email link -> detail modal
    if (target.classList.contains('cell-link')) {
      var userId = target.getAttribute('data-id');
      if (userId) openUserDetail(userId);
      return;
    }

    // Toggle button
    if (target.classList.contains('btn-toggle')) {
      var userId = target.getAttribute('data-id');
      var action = target.getAttribute('data-action');
      if (userId && action) handleToggleUser(userId, action);
      return;
    }

    // Delete button
    if (target.classList.contains('btn-delete')) {
      var userId = target.getAttribute('data-id');
      if (userId) handleDeleteUser(userId);
      return;
    }
  }

  // ====== Search ======
  function handleSearch() {
    currentPage = 1;
    loadUsers();
  }

  // ====== Date formatting ======
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var y = d.getFullYear();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return y + '年' + m + '月' + day + '日';
    } catch (_) {
      return dateStr;
    }
  }

  // ====== HTML escape ======
  function esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ====== Initialization ======
  function init() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Search
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSearch();
    });
    statusFilter.addEventListener('change', handleSearch);
    adminFilter.addEventListener('change', handleSearch);

    // Pagination
    prevPageBtn.addEventListener('click', goToPrevPage);
    nextPageBtn.addEventListener('click', goToNextPage);

    // Table event delegation
    userTbody.addEventListener('click', handleTableClick);

    // Modal close
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    // Check existing session
    var token = getToken();
    var savedUser = localStorage.getItem('admin_user');
    if (token && savedUser) {
      try {
        var user = JSON.parse(savedUser);
        showDashboard(user);
      } catch (_) {
        showLogin();
      }
    } else {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
