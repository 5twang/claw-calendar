const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// 加密盐值必须从环境变量获取
const SALT = process.env.ENCRYPTION_SALT;
if (!SALT) {
  throw new Error('ENCRYPTION_SALT environment variable is required');
}

// 加密级别配置
const ENCRYPTION_LEVEL = process.env.ENCRYPTION_LEVEL || 'full';

// 不同级别的加密字段定义（内部使用）
const ENCRYPTION_FIELDS = {
  standard: ['description', 'location'],  // 仅敏感字段
  full: ['title', 'description', 'location'],  // 事件全加密
  maximum: ['title', 'description', 'location', 'calendar_name', 'calendar_description']  // 全部加密
};

// 获取当前加密级别需要加密的字段列表（内部使用）
function getEncryptedFields() {
  return ENCRYPTION_FIELDS[ENCRYPTION_LEVEL] || ENCRYPTION_FIELDS.full;
}

// 派生加密密钥
function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return crypto.scryptSync(key, SALT, 32);
}

// 生成API Key（明文返回给用户，哈希存入数据库）
function generateApiKey() {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const key = `claw-calendar-${randomPart}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}

// 验证API Key
function verifyApiKey(key, hash) {
  const computedHash = crypto.createHash('sha256').update(key).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

// 加密敏感数据
function encrypt(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted
  });
}

// 解密敏感数据
function decrypt(encryptedObj) {
  if (!encryptedObj) return null;
  
  try {
    const obj = typeof encryptedObj === 'string' ? JSON.parse(encryptedObj) : encryptedObj;
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(obj.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(obj.authTag, 'hex'));
    
    let decrypted = decipher.update(obj.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed: ' + err.message);
  }
}

// ==================== 全数据加密增强功能 ====================

/**
 * 加密对象中的指定字段
 * @param {Object} data - 原始数据对象
 * @param {Array} fields - 需要加密的字段列表
 * @returns {Object} - 加密后的数据对象
 */
function encryptFields(data, fields) {
  if (!data || typeof data !== 'object') return data;
  
  const encrypted = { ...data };
  const fieldsToEncrypt = fields || getEncryptedFields();
  
  for (const field of fieldsToEncrypt) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }
  
  return encrypted;
}

/**
 * 解密对象中的指定字段
 * @param {Object} data - 加密后的数据对象
 * @param {Array} fields - 需要解密的字段列表
 * @returns {Object} - 解密后的数据对象
 */
function decryptFields(data, fields) {
  if (!data || typeof data !== 'object') return data;
  
  const decrypted = { ...data };
  const fieldsToDecrypt = fields || getEncryptedFields();
  
  for (const field of fieldsToDecrypt) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decrypt(decrypted[field]);
      } catch (err) {
        // 如果解密失败，可能是明文存储（兼容旧数据）
        console.warn(`Field ${field} decryption failed, treating as plaintext`);
      }
    }
  }
  
  return decrypted;
}

/**
 * 批量解密数组中的对象
 * @param {Array} items - 数据对象数组
 * @param {Array} fields - 需要解密的字段列表
 * @returns {Array} - 解密后的数组
 */
function decryptArray(items, fields) {
  if (!Array.isArray(items)) return items;
  return items.map(item => decryptFields(item, fields));
}



// 密码哈希（用于用户密码）
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ':' + derivedKey.toString('hex'));
    });
  });
}

// 验证密码
async function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(crypto.timingSafeEqual(
        Buffer.from(key, 'hex'),
        derivedKey
      ));
    });
  });
}

module.exports = {
  generateApiKey,
  verifyApiKey,
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  // 加密工具函数
  encryptFields,
  decryptFields,
  decryptArray,
  // 仅供内部使用的常量和函数
  ENCRYPTION_LEVEL
};
