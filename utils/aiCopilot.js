const Groq = require("groq-sdk");

/**
 * Generates optimized product content using AI
 * @param {Object} productData - Current product details
 * @returns {Promise<Object>} - Optimized fields
 */
const optimizeProductContent = async (productData) => {
  const { name, category, subCategory, material, description } = productData;

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing from environment variables. Please check your .env file.");
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const prompt = `
    You are a premium fashion e-commerce copywriter. Optimize the following product details for high conversion and SEO.
    
    Product Name: ${name}
    Category: ${category}
    Sub-Category: ${subCategory}
    Material: ${material}
    Current Description: ${description}

    Return a JSON object with exactly these fields:
    - seoTitle: A compelling SEO title (max 60 chars)
    - metaDescription: A persuasive meta description (max 160 chars)
    - hook: A one-line captivating hook
    - shortDescription: A 2-3 sentence punchy summary
    - keyFeatures: An array of 4-5 key features
    - benefits: An array of 3-4 customer benefits
    - usp: A unique selling proposition
    - searchTags: An array of 10 relevant SEO keywords
    - socialMediaCaption: An engaging Instagram-style caption with emojis
    
    Only return valid JSON. Do not include markdown formatting or explanations.
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that returns only valid JSON for product optimization."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    return JSON.parse(chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error("AI Copilot Error:", error);
    throw new Error("Failed to generate AI content");
  }
};

module.exports = {
  optimizeProductContent
};
