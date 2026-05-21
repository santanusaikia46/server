const supabase = require("../config/supabase");

async function updateCategory() {
  try {
    console.log("Updating category 'Accessories' to 'Home' in products...");
    const { data, error } = await supabase
      .from('products')
      .update({ category: 'Home' })
      .eq('category', 'Accessories')
      .select();

    if (error) {
      console.error("Error updating category:", error);
    } else {
      console.log(`Successfully updated ${data.length} products.`);
    }
  } catch (err) {
    console.error("Script error:", err);
  }
}

updateCategory();
