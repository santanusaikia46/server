const nodemailer = require("nodemailer");
const dns = require("dns");

const sendEmail = async (options) => {
  // Manually resolve the IPv4 address to definitively bypass Node.js IPv6 ENETUNREACH issues
  const ipv4Address = await new Promise((resolve, reject) => {
    dns.lookup("smtp.gmail.com", { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });

  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: ipv4Address,
    port: 465,
    secure: true, // use SSL/TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: "smtp.gmail.com", // Required for certificate validation when using an IP address
    },
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
