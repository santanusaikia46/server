const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  try {
    console.log(`Attempting to send email to: ${options.email} via Resend`);
    
    // The "from" address in Resend must be a verified domain.
    // For testing without a verified domain, Resend allows sending from 'onboarding@resend.dev' 
    // to the email address associated with your Resend account.
    // Replace with your verified domain email (e.g. no-reply@yourdomain.com) when ready for production.
    const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    
    const { data, error } = await resend.emails.send({
      from: `TatiAssam <${fromAddress}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error(error.message);
    }

    console.log(`Email sent successfully via Resend. Message ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
};

module.exports = sendEmail;
