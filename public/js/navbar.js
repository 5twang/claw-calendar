/**
 * 共享导航栏组件
 * 通过 fetch 加载导航栏 HTML 并注入到页面
 */
async function loadNavbar() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  
  const navbarHTML = `
    <nav class="navbar">
      <div class="container">
        <a href="/dashboard.html" class="navbar-brand">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Claw-Calendar
        </a>
        <button class="navbar-toggler" onclick="toggleNavbar()" aria-label="切换导航">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="navbar-nav" id="navbar-nav">
          <a href="/dashboard.html" class="nav-link" data-page="dashboard">控制台</a>
          <a href="/calendar.html" class="nav-link" data-page="calendar">日历</a>
          <a href="/apikeys.html" class="nav-link" data-page="apikeys">API Keys</a>
          <a href="/profile.html" class="nav-link" data-page="profile">设置</a>
          <button onclick="logout()" class="btn btn-sm btn-outline">退出</button>
        </div>
      </div>
    </nav>
  `;

  // 插入导航栏
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="global-message" class="global-message hidden"></div>
    ${navbarHTML}
  `);

  // 高亮当前页面链接
  const pageName = currentPage.replace('.html', '');
  const activeLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', loadNavbar);
