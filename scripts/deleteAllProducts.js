require('dotenv').config();
const supabase = require('../config/supabase');

async function deleteAllProducts() {
  try {
    console.log('Deleting all enquiries first to resolve foreign keys...');
    // We can filter by not null since all product_id should be not null if it's related
    const { error: enqError } = await supabase
      .from('enquiries')
      .delete()
      .not('product_id', 'is', null);
    
    if (enqError) {
      console.log('Error deleting enquiries:', enqError.message);
    }

    console.log('Deleting all products...');
    const { data: products, error: fetchError } = await supabase.from('products').select('id');
    if (fetchError) throw fetchError;

    if (products.length === 0) {
      console.log('No products to delete.');
      return;
    }

    const ids = products.map(p => p.id);
    // Delete in batches if necessary, or all at once using in()
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .in('id', ids);

    if (deleteError) throw deleteError;

    console.log(`Successfully deleted ${ids.length} products.`);
  } catch (error) {
    console.error('Failed to delete products:', error.message);
  }
}

deleteAllProducts();
