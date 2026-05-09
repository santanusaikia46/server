require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

async function updateProduct() {
  try {
    const filePath = path.join(__dirname, '../../sample.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const productData = JSON.parse(fileContent);

    // Properly format the marketing object as strings according to frontend expectations
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

    const updates = {
      fit: productData.fitSizeStyle || productData.fit || '',
      marketing: formattedMarketing
    };

    console.log('Updating product ID f56ac09c-fc21-4125-9fd5-b9c78fb63c71 ...');

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', 'f56ac09c-fc21-4125-9fd5-b9c78fb63c71')
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updatedProduct) {
      console.log('Product not found! Maybe ID changed?');
    } else {
      console.log('Successfully updated product marketing & fit fields!');
    }
  } catch (error) {
    console.error('Failed to update product:', error.message);
  }
}

updateProduct();
