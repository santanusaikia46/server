const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // Create a transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    family: 4, // Force IPv4
  });

  // Verify connection configuration
  try {
    await transporter.verify();
    console.log("SMTP server connection verified successfully");
  } catch (verifyError) {
    console.error("SMTP verification failed:", verifyError);
    throw verifyError;
  }

  // Define email options
  const mailOptions = {
    from: `"TatiAssam" <${process.env.SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // Send the email
  try {
    console.log(`Attempting to send email to: ${options.email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending email:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    throw error;
  }
};

module.exports = sendEmail;
