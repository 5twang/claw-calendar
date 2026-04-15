/**
 * 环境变量配置验证
 * 启动时检查必需的环境变量，缺失时给出清晰的错误信息
 */

const REQUIRED = [];
const CONDITIONAL = [];
const OPTIONAL_WARN = [];

function init() {
  // 必需的环境变量（无默认值，启动时必须有）
  REQUIRED.push(
    { name: 'JWT_SECRET', desc: 'JWT 签名密钥' },
    { name: 'ENCRYPTION_SALT', desc: '数据加密盐值' }
  );

  // 条件必需的环境变量
  const dbType = process.env.DATABASE_TYPE || 'file';
  if (dbType === 'postgres') {
    CONDITIONAL.push({
      name: 'DATABASE_URL',
      desc: 'PostgreSQL 连接字符串',
      condition: 'DATABASE_TYPE=postgres'
    });
  }

  const encLevel = process.env.ENCRYPTION_LEVEL || 'full';
  if (encLevel === 'full') {
    CONDITIONAL.push({
      name: 'ENCRYPTION_KEY',
      desc: 'AES-256 加密密钥（32字节 hex）',
      condition: 'ENCRYPTION_LEVEL=full'
    });
  }

  // 可选但缺失会有警告的
  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!hasSmtp) {
    OPTIONAL_WARN.push(
      { name: 'SMTP_HOST/SMTP_USER/SMTP_PASS', desc: '邮件发送（SMTP）' }
    );
  }
}

function validate() {
  init();

  const errors = [];
  const warnings = [];

  // 检查必需变量
  for (const item of REQUIRED) {
    if (!process.env[item.name]) {
      errors.push(`[必需] ${item.name} - ${item.desc}`);
    }
  }

  // 检查条件必需变量
  for (const item of CONDITIONAL) {
    if (!process.env[item.name]) {
      errors.push(`[必需] ${item.name} - ${item.desc} (${item.condition})`);
    }
  }

  // 检查可选变量（警告）
  for (const item of OPTIONAL_WARN) {
    warnings.push(`[可选] ${item.name} - ${item.desc}`);
  }

  return { errors, warnings };
}

function checkAndReport() {
  const { errors, warnings } = validate();

  if (errors.length > 0) {
    console.error('\n❌ 环境变量配置错误：\n');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\n请在 .env 文件或环境变量中设置上述变量。\n');
    return false;
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️ 部分功能不可用（可选环境变量未设置）：\n');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  // 额外安全检查
  securityCheck();

  return true;
}

function securityCheck() {
  const warnings = [];

  // 检查 JWT_SECRET 长度
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push(`JWT_SECRET 长度不足 32 字符，建议使用更强的密钥`);
  }

  // 检查 ENCRYPTION_SALT 长度
  const salt = process.env.ENCRYPTION_SALT;
  if (salt && salt.length < 16) {
    warnings.push(`ENCRYPTION_SALT 长度不足 16 字符，建议使用更强的盐值`);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️ 安全建议：\n');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
}

module.exports = {
  validate,
  checkAndReport
};
