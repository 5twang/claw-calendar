/**
 * 加密工具测试
 * 覆盖率目标：API Key生成验证、密码哈希、加密解密
 */

const {
  generateApiKey,
  verifyApiKey,
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword
} = require('../src/utils/crypto');

describe('加密工具', () => {
  describe('generateApiKey & verifyApiKey', () => {
    test('应该生成有效的API Key', () => {
      const { key, hash } = generateApiKey();
      
      expect(key).toBeDefined();
      expect(hash).toBeDefined();
      expect(key.length).toBe(78); // 'claw-calendar-' + 64 hex chars
      expect(hash.length).toBe(64); // SHA256 hex
    });
    
    test('应该验证正确的API Key', () => {
      const { key, hash } = generateApiKey();
      const isValid = verifyApiKey(key, hash);
      
      expect(isValid).toBe(true);
    });
    
    test('应该拒绝错误的API Key', () => {
      const { hash } = generateApiKey();
      const wrongKey = 'a'.repeat(64);
      const isValid = verifyApiKey(wrongKey, hash);
      
      expect(isValid).toBe(false);
    });
    
    test('每次生成的Key应该不同', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      
      expect(key1.key).not.toBe(key2.key);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe('hashPassword & verifyPassword', () => {
    test('应该正确哈希密码', async () => {
      const hash = await hashPassword('mypassword');
      
      expect(hash).toBeDefined();
      expect(hash).toContain(':'); // salt:hash格式
    });
    
    test('应该验证正确的密码', async () => {
      const hash = await hashPassword('mypassword');
      const isValid = await verifyPassword('mypassword', hash);
      
      expect(isValid).toBe(true);
    });
    
    test('应该拒绝错误的密码', async () => {
      const hash = await hashPassword('mypassword');
      const isValid = await verifyPassword('wrongpassword', hash);
      
      expect(isValid).toBe(false);
    });
    
    test('相同密码应该产生不同哈希', async () => {
      const hash1 = await hashPassword('mypassword');
      const hash2 = await hashPassword('mypassword');
      
      expect(hash1).not.toBe(hash2);
      
      // 但都应该验证通过
      expect(await verifyPassword('mypassword', hash1)).toBe(true);
      expect(await verifyPassword('mypassword', hash2)).toBe(true);
    });
  });

  describe('encrypt & decrypt', () => {
    test('应该正确加密和解密', () => {
      const original = '敏感数据内容';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(decrypted).toBe(original);
    });
    
    test('应该处理空值', () => {
      expect(encrypt(null)).toBeNull();
      expect(encrypt('')).toBeNull();
      expect(decrypt(null)).toBeNull();
    });
    
    test('加密结果应该不同（因为有随机IV）', () => {
      const text = '测试数据';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(text);
      expect(decrypt(encrypted2)).toBe(text);
    });
    
    test('应该处理长文本', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = encrypt(longText);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(longText);
    });
    
    test('应该处理特殊字符', () => {
      const specialText = '特殊字符：!@#$%^&*()_+-=[]{}|;\':",./<>?';
      const encrypted = encrypt(specialText);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(specialText);
    });
  });
});
