const express = require("express");
const supabase = require("../config/supabase");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const { productSchema, validate, validateId } = require("../utils/validation");

const router = express.Router();

// Simple in-memory cache to make GET requests super fast
const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const clearCache = () => {
  cache.clear();
};

const sanitizeProduct = (product) => ({
  _id: product.id,
  id: product.id,
  ...product
});

// GET all products
router.get("/", async (req, res, next) => {
  try {
    const { keyword, category, minPrice, maxPrice, size, color, inStock, sort, limit, page, admin } = req.query;
    
    // Check cache first (skip cache for admin)
    const cacheKey = `products_${req.originalUrl}`;
    if (admin !== 'true' && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() < cached.expiry) {
        return res.json(cached.data);
      }
    }
    
    // Remove { count: 'exact' } as it causes full table scans and slows down the DB
    let selectFields = admin === 'true' 
      ? '*' 
      : 'id, name, price, image, category, countInStock, variants, isActive, featured, createdAt';
    
    let query = supabase.from('products').select(selectFields);

    if (admin !== 'true') {
      query = query.eq('isActive', true);
    }
    
    if (keyword) {
      query = query.ilike('name', `%${keyword}%`);
    }
    
    if (category) {
      const cats = category.split(",");
      query = query.in('category', cats);
    }
    
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }
    
    // For JSONB variants, we use contains to check if an array element has the size/color
    if (size) {
      const sizes = size.split(",");
      // This is a simplified check. For an array of sizes, we might need multiple or conditions
      // For now, checking the first size
      query = query.contains('variants', `[{"size": "${sizes[0]}"}]`);
    }
    
    if (color) {
      const colors = color.split(",");
      query = query.contains('variants', `[{"color": "${colors[0]}"}]`);
    }
    
    // Note: Postgres will have lowercased countInStock if unquoted in schema, 
    // but assuming we use double quotes in schema or exact match.
    if (inStock === 'true') {
      // Trying to match the column name. If it fails, we might need "countinstock"
      query = query.gt('countInStock', 0).or('countinstock.gt.0'); 
    }

    // Sorting logic
    if (sort) {
      const isDesc = sort.startsWith('-');
      const sortField = isDesc ? sort.substring(1) : sort;
      query = query.order(sortField, { ascending: !isDesc });
    } else {
      query = query.order('createdAt', { ascending: false }); // Default: newest first
    }

    // Pagination logic
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20; // Default limit 20
    const skip = (pageNumber - 1) * limitNumber;

    query = query.range(skip, skip + limitNumber - 1);

    const { data: products, error } = await query;
    
    if (error) throw error;

    const responseData = { 
      success: true, 
      data: products.map(sanitizeProduct),
      pagination: {
        page: pageNumber,
        limit: limitNumber
      }
    };

    // Store in cache
    if (admin !== 'true') {
      cache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL });
    }

    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

// GET featured products
router.get("/featured", async (req, res, next) => {
  try {
    const cacheKey = "products_featured";
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() < cached.expiry) {
        return res.json(cached.data);
      }
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, image, category, countInStock, variants, isActive, featured, createdAt')
      .eq('featured', true)
      .eq('isActive', true);
      
    if (error) throw error;

    // Fallback: if no featured products set, return newest 5
    if (!products || products.length === 0) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select('id, name, price, image, category, countInStock, variants, isActive, featured, createdAt')
        .eq('isActive', true)
        .order('createdAt', { ascending: false })
        .limit(5);
        
      if (fallbackError) throw fallbackError;
      
      const responseData = { success: true, data: fallback.map(sanitizeProduct) };
      cache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL });
      return res.json(responseData);
    }
    
    const responseData = { success: true, data: products.map(sanitizeProduct) };
    cache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL });
    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

// GET single product
router.get("/:id", validateId, async (req, res, next) => {
  try {
    const { admin } = req.query;
    let query = supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id);

    if (admin !== 'true') {
      query = query.eq('isActive', true);
    }

    const { data: product, error } = await query.maybeSingle();
      
    if (error) throw error;

    if (product) {
      res.json({ success: true, data: sanitizeProduct(product) });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    next(error);
  }
});

// POST create product (Admin only)
router.post("/", auth, admin, validate(productSchema), async (req, res, next) => {
  try {
    const { name, price, description, image, images, category, subCategory, vendor, countInStock, material, careInstructions, fit, size, color, featured, isActive, variants, marketing } = req.body;
    
    const newProduct = {
      name: name || 'Sample name',
      price: price || 0,
      image: image || '/images/sample.jpg',
      images: images || [],
      category: category || 'Sample category',
      subCategory: subCategory || '',
      vendor: vendor || '',
      countInStock: countInStock || 0,
      description: description || 'Sample description',
      material: material || '',
      careInstructions: careInstructions || '',
      fit: fit || '',
      size: size || '',
      color: color || '',
      featured: featured || false,
      isActive: isActive !== undefined ? isActive : true,
      variants: variants || [],
      marketing: marketing || {}
    };

    // Postgres will automatically set id, createdAt, updatedAt
    const { data: createdProduct, error } = await supabase
      .from('products')
      .insert([newProduct])
      .select()
      .single();
      
    if (error) throw error;

    clearCache(); // Invalidate cache on new product

    res.status(201).json({ success: true, data: sanitizeProduct(createdProduct) });
  } catch (error) {
    next(error);
  }
});

// PUT update product (Admin only)
router.put("/:id", auth, admin, validateId, async (req, res, next) => {
  try {
    const { name, price, description, image, images, category, subCategory, vendor, countInStock, material, careInstructions, fit, size, color, featured, isActive, variants, marketing } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (price !== undefined) updates.price = price;
    if (description !== undefined) updates.description = description;
    if (image !== undefined) updates.image = image;
    if (images !== undefined) updates.images = images;
    if (category !== undefined) updates.category = category;
    if (subCategory !== undefined) updates.subCategory = subCategory;
    if (vendor !== undefined) updates.vendor = vendor;
    if (countInStock !== undefined) updates.countInStock = countInStock;
    if (material !== undefined) updates.material = material;
    if (careInstructions !== undefined) updates.careInstructions = careInstructions;
    if (fit !== undefined) updates.fit = fit;
    if (size !== undefined) updates.size = size;
    if (color !== undefined) updates.color = color;
    if (variants !== undefined) updates.variants = variants;
    if (featured !== undefined) updates.featured = featured;
    if (isActive !== undefined) updates.isActive = isActive;
    if (marketing !== undefined) updates.marketing = marketing;
    
    updates.updatedAt = new Date().toISOString();

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
      
    if (error) throw error;

    if (updatedProduct) {
      clearCache(); // Invalidate cache on update
      res.json({ success: true, data: sanitizeProduct(updatedProduct) });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    next(error);
  }
});

// DELETE product (Admin only)
router.delete("/:id", auth, admin, validateId, async (req, res, next) => {
  try {
    // 1. Delete related enquiries first to avoid foreign key violation
    const { error: enqError } = await supabase
      .from('enquiries')
      .delete()
      .eq('product_id', req.params.id);
      
    if (enqError) throw enqError;

    // 2. Now delete the product
    const { data: product, error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
      
    if (error) throw error;

    if (product) {
      clearCache(); // Invalidate cache on delete
      res.json({ success: true, message: "Product removed" });
    } else {
      res.status(404).json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
