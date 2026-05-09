require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

async function addProduct() {
  try {
    const filePath = path.join(__dirname, '../../sample.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const productData = JSON.parse(fileContent);

    // Map the product data to match the products schema if needed, but the provided JSON seems to match exactly the schema used in the POST route
    const newProduct = {
      name: productData.seoProductTitle || productData.name,
      price: productData.price || 0,
      image: productData.image || '/images/sample.jpg',
      images: productData.images || [],
      category: productData.category || 'Sample category',
      subCategory: productData.subCategory || '',
      vendor: productData.vendor || '',
      countInStock: productData.countInStock || 0,
      description: productData.longDescription || productData.description || 'Sample description',
      material: productData.materialDescription || '',
      careInstructions: Array.isArray(productData.careInstructions) 
          ? productData.careInstructions.join(', ') 
          : productData.careInstructions || '',
      fit: productData.fit || '',
      featured: productData.featured || false,
      variants: productData.variants || [],
      marketing: productData.marketing || {}
    };

    console.log('Inserting product:', newProduct.name);

    const { data: createdProduct, error } = await supabase
      .from('products')
      .insert([newProduct])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('Successfully added product!');
    console.log('Product ID:', createdProduct.id);
  } catch (error) {
    console.error('Failed to add product:', error.message);
  }
}

addProduct();
