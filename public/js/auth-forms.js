/**
 * Claw-Calendar - 认证表单页面初始化
 * 包含所有认证相关页面的表单处理逻辑
 * 配合 CSP 'self' 策略使用，无需 unsafe-inline
 */

(function() {
  'use strict';

  // ============================================
  // 注册页面初始化
  // ============================================
  function initRegisterPage() {
    const form = document.getElementById('register-form');
    if (!form) return;

    // 如果已登录则跳转
    if (typeof redirectIfLoggedIn === 'function') {
      redirectIfLoggedIn();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      // 验证
      if (!email || !password) {
        showMessage('message', '请填写邮箱和密码', 'error');
        return;
      }

      if (password.length < 8) {
        showMessage('message', '密码长度至少8位', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showMessage('message', '两次输入的密码不一致', 'error');
        return;
      }

      setLoading('submit-btn', true);

      try {
        const result = await register(email, password, name || null);
        setLoading('submit-btn', false);

        if (result.success) {
          if (result.requireVerification) {
            showMessage('message', '注册成功！验证邮件已发送到您的邮箱，请点击邮件中的链接激活账户。', 'success');
            setTimeout(() => {
              window.location.href = '/login.html';
            }, 3000);
          } else {
            showMessage('message', '注册成功！正在跳转...', 'success');
            setTimeout(() => {
              window.location.href = '/dashboard.html';
            }, 1000);
          }
        } else {
          showMessage('message', result.error, 'error');
        }
      } catch (error) {
        setLoading('submit-btn', false);
        showMessage('message', '注册失败，请稍后重试', 'error');
      }
    });

    // 实时验证密码匹配
    const confirmPasswordInput = document.getElementById('confirm-password');
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener('input', (e) => {
        const password = document.getElementById('password').value;
        const confirmPassword = e.target.value;

        if (confirmPassword && password !== confirmPassword) {
          e.target.classList.add('error');
        } else {
          e.target.classList.remove('error');
        }
      });
    }
  }

  // ============================================
  // 登录页面初始化
  // ============================================
  function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // 如果已登录则跳转
    if (typeof redirectIfLoggedIn === 'function') {
      redirectIfLoggedIn();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showMessage('message', '请填写邮箱和密码', 'error');
        return;
      }

      setLoading('submit-btn', true);

      try {
        const result = await login(email, password);
        setLoading('submit-btn', false);

        if (result.success) {
          showMessage('message', '登录成功！正在跳转...', 'success');
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 500);
        } else {
          showMessage('message', result.error?.message || result.error, 'error');
        }
      } catch (error) {
        setLoading('submit-btn', false);
        showMessage('message', '登录失败，请稍后重试', 'error');
      }
    });

    // 检查是否有注册成功的提示
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
      showMessage('message', '注册成功！请登录', 'success');
    }
  }

  // ============================================
  // 忘记密码页面初始化
  // ============================================
  function initForgotPasswordPage() {
    const form = document.getElementById('forgot-form');
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submit-btn');
    if (!form || !messageDiv || !submitBtn) return;

    function showFormMessage(message, type = 'error') {
      messageDiv.textContent = message;
      messageDiv.className = 'alert alert-' + type;
      messageDiv.classList.remove('hidden');

      if (type === 'success') {
        setTimeout(() => {
          messageDiv.classList.add('hidden');
        }, 5000);
      }
    }

    function setFormLoading(loading) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? '发送中...' : '发送验证码';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();

      if (!email) {
        showFormMessage('请输入邮箱地址');
        return;
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showFormMessage('邮箱格式不正确');
        return;
      }

      setFormLoading(true);

      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
          showFormMessage(data.message || '验证码已发送，请查收邮箱', 'success');

          setTimeout(() => {
            window.location.href = '/reset-password-code.html?email=' + encodeURIComponent(email);
          }, 2000);
        } else {
          showFormMessage(data.error || '发送失败，请稍后重试');
        }
      } catch (error) {
        showFormMessage('网络错误，请稍后重试');
      } finally {
        setFormLoading(false);
      }
    });
  }

  // ============================================
  // 验证码重置密码页面初始化
  // ============================================
  function initResetPasswordCodePage() {
    // 支持两种表单 ID：reset-form（统一风格）和 resetForm（旧风格）
    const form = document.getElementById('reset-form') || document.getElementById('resetForm');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');

    // Toast 提示函数（兼容旧版页面）
    function showToast(message, type) {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.className = 'toast toast-' + type;
        setTimeout(() => {
          toast.className = 'toast';
        }, 3000);
      }
    }

    // 统一消息函数
    function showMessage(message, type) {
      const messageDiv = document.getElementById('message');
      if (messageDiv) {
        const iconSvg = type === 'success'
          ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
        messageDiv.innerHTML = iconSvg + '<span>' + message + '</span>';
        messageDiv.className = 'alert alert-' + type;
        messageDiv.classList.remove('hidden');
        return;
      }
      // 如果没有 message div，使用 Toast
      showToast(message, type || 'error');
    }

    if (!email) {
      showMessage('请从"忘记密码"页面发起重置请求', 'error');
      form.style.display = 'none';
      return;
    }

    // 设置邮箱输入框
    const emailInput = document.getElementById('email');
    if (emailInput) {
      emailInput.value = decodeURIComponent(email);
      emailInput.readOnly = true;
    }

    const submitBtn = document.getElementById('submit-btn') || document.getElementById('submitBtn');
    if (!submitBtn) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 支持两种字段名：new-password（统一）和 newPassword（旧）
      const newPasswordInput = document.getElementById('new-password') || document.getElementById('newPassword');
      const confirmPasswordInput = document.getElementById('confirm-password') || document.getElementById('confirmPassword');
      const codeInput = document.getElementById('code');

      const code = codeInput ? codeInput.value.trim() : '';
      const newPassword = newPasswordInput ? newPasswordInput.value : '';
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

      if (!code) {
        showMessage('请输入验证码');
        return;
      }

      if (newPassword.length < 8) {
        showMessage('密码长度至少8位');
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage('两次输入的密码不一致');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '重置中...';

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            code: code,
            newPassword: newPassword
          })
        });

        const data = await response.json();

        if (data.success) {
          showMessage('密码重置成功！', 'success');
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 1500);
        } else {
          // 提取错误信息（后端返回 { error: { message, code } }）
          const errorMsg = (data.error && data.error.message) || data.error || '验证失败，请检查验证码';
          showMessage(errorMsg);
          submitBtn.disabled = false;
          submitBtn.textContent = '重置密码';
        }
      } catch (error) {
        showMessage('网络错误，请稍后重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '重置密码';
      }
    });
  }

  // ============================================
  // 邮箱验证页面初始化
  // ============================================
  function initVerifyEmailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    function showSuccess(title, message) {
      const loading = document.getElementById('loading');
      const result = document.getElementById('result');

      if (loading) loading.style.display = 'none';
      if (result) {
        result.style.display = 'block';

        const iconEl = document.getElementById('result-icon');
        const titleEl = document.getElementById('result-title');
        const messageEl = document.getElementById('result-message');
        const btnEl = document.getElementById('result-btn');

        if (iconEl) {
          iconEl.innerHTML = '<div class="verify-icon success">' +
            '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' +
            '</div>';
        }
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.innerHTML = '<p>' + message + '</p>';
        if (btnEl) {
          btnEl.textContent = '前往登录';
          btnEl.href = '/login.html';
        }
      }
    }

    function showError(message) {
      const loading = document.getElementById('loading');
      const result = document.getElementById('result');

      if (loading) loading.style.display = 'none';
      if (result) {
        result.style.display = 'block';

        const iconEl = document.getElementById('result-icon');
        const titleEl = document.getElementById('result-title');
        const messageEl = document.getElementById('result-message');
        const btnEl = document.getElementById('result-btn');

        if (iconEl) {
          iconEl.innerHTML = '<div class="verify-icon error">' +
            '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
            '</div>';
        }
        if (titleEl) titleEl.textContent = '验证失败';
        if (messageEl) messageEl.innerHTML = '<div class="error-message">' + message + '</div>';
        if (btnEl) {
          btnEl.textContent = '返回注册';
          btnEl.href = '/register.html';
        }
      }
    }

    if (!token) {
      showError('缺少验证令牌');
      return;
    }

    // 发送验证请求
    fetch('/api/auth/verify-email?token=' + token)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showSuccess('邮箱验证成功！', '您的账户已激活，现在可以登录使用了。');
        } else {
          showError(data.error || '验证失败');
        }
      })
      .catch(() => {
        showError('网络错误，请稍后重试');
      });
  }

  // ============================================
  // 重置密码页面初始化（Token 方式）
  // ============================================
  function initResetPasswordPage() {
    const form = document.getElementById('reset-form');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      showMessage('message', '缺少重置令牌', 'error');
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword.length < 8) {
        showMessage('message', '密码长度至少8位', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage('message', '两次输入的密码不一致', 'error');
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = '重置中...';

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            newPassword: newPassword
          })
        });

        const data = await response.json();

        if (data.success) {
          showMessage('message', '密码重置成功！', 'success');
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 1500);
        } else {
          showMessage('message', data.error || '重置失败', 'error');
        }
      } catch (error) {
        showMessage('message', '网络错误，请稍后重试', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '重置密码';
      }
    });
  }

  // ============================================
  // 页面自动初始化
  // ============================================
  function initAuthPage() {
    const path = window.location.pathname;

    if (path.endsWith('register.html')) {
      initRegisterPage();
    } else if (path.endsWith('login.html')) {
      initLoginPage();
    } else if (path.endsWith('forgot-password.html')) {
      initForgotPasswordPage();
    } else if (path.endsWith('reset-password-code.html')) {
      initResetPasswordCodePage();
    } else if (path.endsWith('verify-email.html')) {
      initVerifyEmailPage();
    } else if (path.endsWith('reset-password.html')) {
      initResetPasswordPage();
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPage);
  } else {
    initAuthPage();
  }

  // 导出全局函数供外部调用
  window.initRegisterPage = initRegisterPage;
  window.initLoginPage = initLoginPage;
  window.initForgotPasswordPage = initForgotPasswordPage;
  window.initResetPasswordCodePage = initResetPasswordCodePage;
  window.initVerifyEmailPage = initVerifyEmailPage;
  window.initResetPasswordPage = initResetPasswordPage;

})();
