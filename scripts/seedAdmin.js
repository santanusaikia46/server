const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const supabase = require("../config/supabase");

dotenv.config();

const seedAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME?.trim() || "Admin User";
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD?.trim();

    if (!email || !password) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if admin already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      // Update existing admin
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          password: hashedPassword,
          role: "admin",
          isVerified: true
        })
        .eq('id', existingUser.id);

      if (updateError) throw updateError;
      console.log(`Admin user updated: ${email}`);
    } else {
      // Insert new admin
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          name,
          email,
          password: hashedPassword,
          role: "admin",
          isVerified: true
        }]);

      if (insertError) throw insertError;
      console.log(`Admin user created: ${email}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed to seed admin user:", error.message);
    process.exit(1);
  }
};

seedAdmin();
