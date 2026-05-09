const express = require("express");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const supabase = require("../config/supabase");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const { enquirySchema, validate } = require("../utils/validation");

const router = express.Router();

const sanitizeEnquiry = (enq) => {
  const prodObj = enq.products || enq.product;
  return {
    _id: enq.id,
    id: enq.id,
    ...enq,
    product: prodObj ? { _id: prodObj.id, id: prodObj.id, name: prodObj.name, image: prodObj.image, price: prodObj.price } : enq.product_id,
    products: undefined,
    product_id: undefined
  };
};

// POST /api/enquiries - Submit an enquiry
router.post("/", validate(enquirySchema), async (req, res, next) => {
  try {
    const { name, email, phone, message, product, price, color, size, preferredContact } = req.body;

    if (!name || !email || !message || !product || price === undefined) {
      return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    const { data: prod, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product)
      .maybeSingle();

    if (prodError || !prod) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const { data: enquiry, error: enqError } = await supabase
      .from('enquiries')
      .insert([{
        name,
        email,
        phone,
        message,
        product_id: product,
        price,
        color,
        size,
        preferredContact: preferredContact || 'Email',
        status: 'Pending',
        adminNotes: ''
      }])
      .select()
      .single();

    if (enqError) throw enqError;

    // --- WhatsApp Notification via Twilio ---
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER, ADMIN_WHATSAPP_NUMBER } = process.env;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER && ADMIN_WHATSAPP_NUMBER) {
      try {
        const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const waMessage = `*New Product Enquiry!* 🚀\n\n*Name:* ${name}\n*Product:* ${prod.name}\n*Price:* ₹${price}\n*Phone:* ${phone || 'Not Provided'}\n*Email:* ${email}\n\n*Message:*\n${message}`;

        await twilioClient.messages.create({
          body: waMessage,
          from: TWILIO_WHATSAPP_NUMBER,
          to: ADMIN_WHATSAPP_NUMBER
        });
        console.log("WhatsApp notification sent successfully.");
      } catch (waError) {
        console.error("Failed to send WhatsApp notification:", waError);
      }
    } else {
      console.warn("Twilio is not fully configured. Missing environment variables.");
    }

    // Send email using nodemailer
    const { GMAIL_EMAIL, GMAIL_APP_PASSWORD } = process.env;
    if (GMAIL_EMAIL && GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: GMAIL_EMAIL,
            pass: GMAIL_APP_PASSWORD,
          },
        });

        const mailOptions = {
          from: GMAIL_EMAIL,
          to: GMAIL_EMAIL, // Send to admin's own email
          replyTo: email,
          subject: `New Product Enquiry from ${name} for ${prod.name}`,
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eaeaec; border-radius: 8px; overflow: hidden; color: #333333;">
              <div style="background-color: #111111; padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">TatiAssam</h1>
              </div>
              
              <div style="padding: 32px 24px;">
                <h2 style="margin-top: 0; font-size: 18px; color: #111111; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px;">New Product Enquiry</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
                  A customer has submitted a new enquiry for <strong>${prod.name}</strong>. Please review their details below.
                </p>

                <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 16px;">Customer Details</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; width: 100px;">Name</td>
                      <td style="padding: 6px 0; font-weight: 500;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280;">Email</td>
                      <td style="padding: 6px 0;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280;">Phone</td>
                      <td style="padding: 6px 0; font-weight: 500;">${phone || "Not Provided"}</td>
                    </tr>
                    ${preferredContact ? `<tr><td style="padding: 6px 0; color: #6b7280;">Prefers</td><td style="padding: 6px 0; font-weight: 500;">${preferredContact}</td></tr>` : ''}
                  </table>
                </div>

                <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 16px;">Product Information</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280; width: 100px;">Product</td>
                      <td style="padding: 6px 0; font-weight: 500;">${prod.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #6b7280;">Price</td>
                      <td style="padding: 6px 0; font-weight: 500;">₹${price}</td>
                    </tr>
                    ${color ? `<tr><td style="padding: 6px 0; color: #6b7280;">Color</td><td style="padding: 6px 0; font-weight: 500;">${color}</td></tr>` : ''}
                    ${size ? `<tr><td style="padding: 6px 0; color: #6b7280;">Size</td><td style="padding: 6px 0; font-weight: 500;">${size}</td></tr>` : ''}
                  </table>
                </div>

                <div style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                  <h3 style="font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 12px;">Message</h3>
                  <div style="font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap; background-color: #f3f4f6; padding: 16px; border-radius: 6px; border-left: 4px solid #d1d5db;">${message.replace(/\n/g, "<br>")}</div>
                </div>
                
                <div style="text-align: center; margin-top: 32px;">
                  <a href="${process.env.CLIENT_URL}/admin/dashboard" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 500; border-radius: 4px;">View in Command Centre</a>
                </div>
              </div>
              
              <div style="background-color: #f9fafb; border-top: 1px solid #eaeaec; padding: 16px; text-align: center;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification from the TatiAssam platform.</p>
              </div>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Continue, as the enquiry is already saved in DB
      }
    } else {
      console.warn("Nodemailer is not configured. Missing GMAIL_EMAIL or GMAIL_APP_PASSWORD in .env");
    }

    res.status(201).json({
      success: true,
      data: sanitizeEnquiry(enquiry),
      message: "Enquiry submitted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/enquiries - Get all enquiries (Admin only)
router.get("/", auth, admin, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const { data: enquiries, count, error } = await supabase
      .from('enquiries')
      .select('*, products(id, name, image, price)', { count: 'exact' })
      .order('createdAt', { ascending: false })
      .range(skip, skip + limitNumber - 1);
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      data: enquiries.map(sanitizeEnquiry),
      pagination: {
        total: count,
        page: pageNumber,
        pages: Math.ceil(count / limitNumber),
        limit: limitNumber
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/enquiries/:id - Update enquiry status (Admin only)
router.put("/:id", auth, admin, async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    
    const { data: enquiry, error } = await supabase
      .from('enquiries')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, products(id, name, image, price)')
      .maybeSingle();

    if (error) throw error;

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found." });
    }

    res.status(200).json({
      success: true,
      data: sanitizeEnquiry(enquiry),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
