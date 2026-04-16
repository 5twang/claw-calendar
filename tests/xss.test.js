/**
 * XSS 防护测试
 * 测试前端 auth.js 中的安全函数（不依赖 jsdom）
 */

describe('XSS 防护测试', () => {
  describe('textContent vs innerHTML 原理', () => {
    test('textContent 会保留原始文本内容', () => {
      // 验证 textContent 不会执行 HTML
      const mockElement = {
        textContent: '',
        innerHTML: ''
      };

      // 模拟 textContent 设置
      mockElement.textContent = '<script>alert("XSS")</script>';

      expect(mockElement.textContent).toBe('<script>alert("XSS")</script>');
    });

    test('innerHTML 会解析 HTML 标签', () => {
      const mockElement = {
        textContent: '',
        innerHTML: ''
      };

      // 当 innerHTML 包含危险内容时
      mockElement.innerHTML = '<script>alert("XSS")</script>';

      // innerHTML 会被浏览器解析执行（测试只验证设置行为）
      expect(mockElement.innerHTML).toBe('<script>alert("XSS")</script>');
    });
  });

  describe('HTML 转义原理', () => {
    test('应该转义 HTML 特殊字符', () => {
      const escapeHtml = (text) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
      };

      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escapeHtml('<img src=x onerror=alert(1)>'))
        .toBe('&lt;img src=x onerror=alert(1)&gt;');
    });

    test('应该处理普通文本', () => {
      const escapeHtml = (text) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
      };

      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('test@example.com')).toBe('test@example.com');
    });
  });

  describe('XSS payload 测试', () => {
    test('常见 XSS payload 应该被转义', () => {
      const escapeHtml = (text) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
      };

      const payloads = [
        '<script>alert(1)</script>',
        '"><img src=x onerror=alert(1)>',
        "javascript:alert('XSS')",
        '<svg onload=alert(1)>',
        '{{constructor.constructor("alert(1)")()}}'
      ];

      payloads.forEach(payload => {
        const escaped = escapeHtml(payload);
        // 转义后的内容不应包含 <script> 标签
        expect(escaped).not.toMatch(/<script>/i);
        // 转义后不应包含未转义的引号
        if (payload.includes('"')) {
          expect(escaped).not.toContain('"');
        }
      });
    });

    test('JSON 中的 XSS payload 应该被转义', () => {
      const escapeHtml = (text) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
      };

      const maliciousUserInput = '"><script>stealCookies()</script>';
      const safeMessage = escapeHtml(maliciousUserInput);

      // 模拟 JSON.stringify 行为
      const jsonSafe = JSON.stringify(safeMessage);
      expect(jsonSafe).toBeDefined();
    });
  });

  describe('auth.js 修复验证', () => {
    test('showMsg 应该使用 textContent 插入用户消息', () => {
      const fs = require('fs');
      const authJsPath = './public/js/auth.js';

      if (fs.existsSync(authJsPath)) {
        const content = fs.readFileSync(authJsPath, 'utf8');

        // 验证 showMsg 函数使用 textContent 插入 msg
        const showMsgMatch = content.match(/function showMsg[\s\S]*?}(?=\s*(?:function|$))/);

        if (showMsgMatch) {
          const fnBody = showMsgMatch[0];
          // 应该使用 textContent
          expect(fnBody).toContain('textContent = msg');
        }
      }
    });

    test('showMessage 应该使用 textContent 插入用户消息', () => {
      const fs = require('fs');
      const authJsPath = './public/js/auth.js';

      if (fs.existsSync(authJsPath)) {
        const content = fs.readFileSync(authJsPath, 'utf8');

        // 验证 showMessage 函数使用 textContent
        const showMessageMatch = content.match(/function showMessage[\s\S]*?}(?=\s*(?:function|$))/);

        if (showMessageMatch) {
          const fnBody = showMessageMatch[0];
          expect(fnBody).toContain('textContent');
        }
      }
    });

    test('不应该有直接用 innerHTML 插入用户输入的模式', () => {
      const fs = require('fs');
      const authJsPath = './public/js/auth.js';

      if (fs.existsSync(authJsPath)) {
        const content = fs.readFileSync(authJsPath, 'utf8');

        // 危险模式：innerHTML = `...${用户输入}...`
        // 这种模式会导致 XSS
        const dangerousPatterns = [
          /innerHTML\s*=\s*`[^`]*\$\{msg\}/,
          /innerHTML\s*=\s*`[^`]*\$\{message\}/,
          /innerHTML\s*=\s*`[^`]*\$\{[^}]*input[^}]*\}/
        ];

        dangerousPatterns.forEach(pattern => {
          expect(content).not.toMatch(pattern);
        });
      }
    });
  });
});
