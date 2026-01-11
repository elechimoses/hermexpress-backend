import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { generateEmailTemplate } from './emailTemplate.js';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (to, code) => {
  const htmlContent = generateEmailTemplate({
    title: 'Your Verification Code',
    body: `
      <p>Welcome to Hermexpress!</p>
      <p>Please use the following code to verify your email address:</p>
      <h2 style="text-align: center; color: #d900ff54; letter-spacing: 5px;">${code}</h2>
      <p>This code will expire in 15 minutes.</p>
    `,
    buttonText: null,
    buttonLink: null,
  });

  const mailOptions = {
    from: '"Hermexpress" <no-reply@hermexpress.com>',
    to,
    subject: 'Your Verification Code - Hermexpress',
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (to, code) => {
  const htmlContent = generateEmailTemplate({
    title: 'Reset Your Password',
    body: `
      <p>Hello,</p>
      <p>You requested to reset your password. Please use the following code:</p>
      <h2 style="text-align: center; color: #d900ff54; letter-spacing: 5px;">${code}</h2>
      <p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
    `,
    buttonText: null,
    buttonLink: null,
  });

  const mailOptions = {
    from: '"Hermexpress" <no-reply@hermexpress.com>',
    to,
    subject: 'Password Reset Request - Hermexpress',
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Reset email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendShipmentNotifications = async (shipmentDetails) => {
  const { 
    trackingNumber, 
    sender, 
    receiver, 
    totalPrice, 
    paymentMethod
  } = shipmentDetails;

  const sendEmail = async (to, subject, html) => {
      try {
          await transporter.sendMail({
              from: '"Hermexpress" <no-reply@hermexpress.com>',
              to,
              subject,
              html
          });
          console.log(`Email sent to ${to}: ${subject}`);
      } catch (err) {
          console.error(`Failed to send email to ${to}:`, err.message);
      }
  };

  // 1. Sender Email
  const senderHtml = generateEmailTemplate({
    title: 'Shipment Booked Successfully',
    body: `
        <p>Dear ${sender.name},</p>
        <p>Your shipment has been successfully booked!</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p><strong>Total Cost:</strong> ₦${totalPrice.toLocaleString()}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod.name}</p>
            ${paymentMethod.provider === 'bank_transfer' ? `
                <p><strong>Bank Details:</strong><br/>
                Bank: ${paymentMethod.config.bankName}<br/>
                Acct Name: ${paymentMethod.config.accountName}<br/>
                Acct No: ${paymentMethod.config.accountNumber}
                </p>
            ` : ''}
        </div>
        <p>We will pick up your package shortly.</p>
    `,
    buttonText: 'Track Shipment',
    buttonLink: `https://hermexpress.com/track/${trackingNumber}`
  });
  await sendEmail(sender.email, `Booking Confirmed: ${trackingNumber}`, senderHtml);

  // 2. Receiver Email
  const receiverHtml = generateEmailTemplate({
    title: 'Incoming Shipment',
    body: `
        <p>Dear ${receiver.name},</p>
        <p>A shipment is on its way to you from <strong>${sender.name}</strong>.</p>
        <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        <p>You will be notified when it arrives.</p>
    `,
    buttonText: 'Track Shipment',
    buttonLink: `https://hermexpress.com/track/${trackingNumber}`
  });
  await sendEmail(receiver.email, `Incoming Shipment: ${trackingNumber}`, receiverHtml);

  // 3. Admin Email
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@hermexpress.com';
  const adminHtml = generateEmailTemplate({
    title: 'New Shipment Alert',
    body: `
        <p>New shipment booked.</p>
        <p><strong>Tracking:</strong> ${trackingNumber}</p>
        <p><strong>Amount:</strong> ₦${totalPrice.toLocaleString()}</p>
        <p><strong>Method:</strong> ${paymentMethod.name}</p>
    `,
    buttonText: 'View in Admin',
    buttonLink: `https://admin.hermexpress.com/shipments/${trackingNumber}`
  });
  await sendEmail(adminEmail, `New Booking: ${trackingNumber}`, adminHtml);
};
