require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

async function seedProducts() {
  try {
    const filePath = path.join(__dirname, '../../sample.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const productsData = JSON.parse(fileContent);

    if (!Array.isArray(productsData)) {
      throw new Error("sample.json must contain an array of products");
    }

    console.log(`Found ${productsData.length} products to insert.`);

    // Format all products
    const formattedProducts = productsData.map(productData => {
      const marketing = productData.marketing || {};
      
      const formattedMarketing = {
        slug: marketing.urlSlug || '',
        seoTitle: marketing.metaTitle || '',
        metaDescription: marketing.metaDescription || '',
        shortDescription: marketing.shortDescription || '',
        hook: marketing.oneLineHook || '',
        keyFeatures: Array.isArray(marketing.keyFeatures) ? marketing.keyFeatures.join('\n') : marketing.keyFeatures || '',
        benefits: Array.isArray(marketing.benefits) ? marketing.benefits.join('\n') : marketing.benefits || '',
        specifications: marketing.specificationsTable 
          ? Object.entries(marketing.specificationsTable).map(([k,v]) => `${k}: ${v}`).join('\n') 
          : '',
        useCases: Array.isArray(marketing.useCases) ? marketing.useCases.join(', ') : marketing.useCases || '',
        usp: marketing.uspHighlight || '',
        seoKeywords: Array.isArray(marketing.seoKeywords) ? marketing.seoKeywords.join(', ') : marketing.seoKeywords || '',
        searchTags: Array.isArray(marketing.backendSearchTags) ? marketing.backendSearchTags.join(', ') : marketing.backendSearchTags || '',
        faqs: Array.isArray(marketing.faqSection) 
          ? marketing.faqSection.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') 
          : '',
        socialMediaCaption: marketing.socialMediaCaption || '',
        hashtags: Array.isArray(marketing.hashtags) ? marketing.hashtags.join(' ') : marketing.hashtags || '',
        adCopy: marketing.adCopy 
          ? `Short Ad: ${marketing.adCopy.shortAdCopy}\n\nLong Ad: ${marketing.adCopy.longAdCopy}` 
          : ''
      };

      return {
        name: productData.seoProductTitle || productData.name || 'Untitled',
        price: productData.price || 0,
        image: productData.image || '/images/sample.jpg',
        images: productData.images || [],
        category: productData.category || 'Women',
        subCategory: productData.subCategory || '',
        vendor: productData.vendor || '',
        countInStock: productData.countInStock || 0,
        description: productData.longDescription || productData.description || '',
        material: productData.materialDescription || productData.material || '',
        careInstructions: Array.isArray(productData.careInstructions) 
            ? productData.careInstructions.join('\n') 
            : productData.careInstructions || '',
        fit: productData.fitSizeStyle || productData.fit || '',
        featured: productData.featured || false,
        variants: productData.variants || [],
        marketing: formattedMarketing
      };
    });

    // To prevent a huge insert payload from failing, we will insert them in batches of 20
    const batchSize = 20;
    let insertedCount = 0;

    for (let i = 0; i < formattedProducts.length; i += batchSize) {
      const batch = formattedProducts.slice(i, i + batchSize);
      console.log(`Inserting batch ${i / batchSize + 1} (${batch.length} items)...`);
      
      const { data, error } = await supabase
        .from('products')
        .insert(batch)
        .select();

      if (error) {
        throw error;
      }
      
      insertedCount += data.length;
    }

    console.log(`Successfully added ${insertedCount} products!`);

  } catch (error) {
    console.error('Failed to seed products:', error.message);
  }
}

seedProducts();
