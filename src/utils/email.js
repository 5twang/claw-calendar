const nodemailer = require('nodemailer');
const crypto = require('crypto');

// 创建邮件传输器
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  // 从环境变量读取配置
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    console.warn('邮件配置不完整，邮件功能将不可用');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
  
  return transporter;
}

// 生成验证令牌
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 生成6位数字验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送验证邮件
async function sendVerificationEmail(email, token, type = 'verify') {
  const transport = getTransporter();
  if (!transport) {
    console.error('邮件服务未配置');
    return false;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email.html?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM || 'Claw-Calendar <noreply@claw-calendar.com>';
  
  let subject, html;
  
  if (type === 'verify') {
    subject = '验证您的邮箱 - Claw-Calendar';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">验证您的邮箱</h2>
        <p>感谢您注册 Claw-Calendar！请点击下面的链接验证您的邮箱地址：</p>
        <p>
          <a href="${verifyUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            验证邮箱
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          如果按钮无法点击，请复制以下链接到浏览器：<br/>
          <a href="${verifyUrl}" style="color: #007bff;">${verifyUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">此链接将在 24 小时后过期。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          此邮件由系统自动发送，请勿回复。<br/>
          Claw-Calendar - 您的私有日历服务
        </p>
      </div>
    `;
  } else if (type === 'reset') {
    // 验证码模式：token 就是验证码
    const verificationCode = token;
    subject = '重置您的密码 - Claw-Calendar';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">重置您的密码</h2>
        <p>我们收到了重置您密码的请求。如果这是您本人操作，请使用以下验证码：</p>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 4px;">
            ${verificationCode}
          </span>
        </div>
        <p style="color: #666; font-size: 14px;">
          请在密码重置页面输入此验证码来设置新密码。
        </p>
        <p style="color: #dc3545; font-size: 14px;">
          ⚠️ 如果这不是您本人的操作，请忽略此邮件。
        </p>
        <p style="color: #999; font-size: 12px;">此验证码将在 10 分钟后过期。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          此邮件由系统自动发送，请勿回复。<br/>
          Claw-Calendar - 您的私有日历服务
        </p>
      </div>
    `;
  } else if (type === 'register') {
    // 注册验证码
    const verificationCode = token;
    subject = '注册验证码 - Claw-Calendar';
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">欢迎注册 Claw-Calendar</h2>
        <p>感谢您注册 Claw-Calendar！您的注册验证码如下：</p>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px;">
            ${verificationCode}
          </span>
        </div>
        <p style="color: #666; font-size: 14px;">
          请在注册页面输入此验证码来完成注册。
        </p>
        <p style="color: #dc3545; font-size: 14px;">
          ⚠️ 如果这不是您本人的操作，请忽略此邮件。
        </p>
        <p style="color: #999; font-size: 12px;">此验证码将在 10 分钟后过期。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          此邮件由系统自动发送，请勿回复。<br/>
          Claw-Calendar - 您的私有日历服务
        </p>
      </div>
    `;
  }
  
  if (!subject || !html) {
    console.error('未知的邮件类型:', type);
    return false;
  }
  
  try {
    await transport.sendMail({
      from: fromEmail,
      to: email,
      subject,
      html
    });
    console.log(`邮件已发送至: ${email}`);
    return true;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return false;
  }
}

module.exports = {
  generateVerificationToken,
  generateVerificationCode,
  sendVerificationEmail
};
