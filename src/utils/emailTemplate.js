import { EMAIL_BRAND } from '../config/emailConfig.js';

export const generateEmailTemplate = ({ title, body, buttonText, buttonLink }) => {
  const year = new Date().getFullYear();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        background-color: #f4f6f8;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      .header {
        background-color: ${EMAIL_BRAND.primaryColor};
        padding: 20px;
        text-align: center;
        color: #fff;
      }
      .header img {
        max-width: 120px;
        margin-bottom: 10px;
      }
      .content {
        padding: 30px 25px;
        color: #333;
        line-height: 1.6;
      }
      .button {
        display: inline-block;
        background-color: ${EMAIL_BRAND.primaryColor};
        color: #fff !important;
        text-decoration: none;
        padding: 12px 22px;
        border-radius: 5px;
        font-weight: bold;
        margin-top: 20px;
      }
      .footer {
        text-align: center;
        padding: 20px;
        font-size: 13px;
        color: #777;
        background: #f9f9f9;
      }
      a {
        color: ${EMAIL_BRAND.primaryColor};
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <img src="${EMAIL_BRAND.logo}" alt="${EMAIL_BRAND.companyName} Logo" />
        <h2>${title}</h2>
      </div>
      <div class="content">
        ${body}
        ${buttonText && buttonLink ? `<br><a href="${buttonLink}" class="button">${buttonText}</a>` : ''}
      </div>
      <div class="footer">
        <p>${EMAIL_BRAND.footerText}</p>
        <p>&copy; ${year} ${EMAIL_BRAND.companyName}. All rights reserved.</p>
        <p>Need help? <a href="mailto:${EMAIL_BRAND.supportEmail}">${EMAIL_BRAND.supportEmail}</a></p>
      </div>
    </div>
  </body>
  </html>
  `;
};