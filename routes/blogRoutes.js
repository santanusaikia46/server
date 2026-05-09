const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const sanitizeBlog = (blog) => {
  const authorObj = blog.users || blog.author;
  return {
    _id: blog.id,
    id: blog.id,
    ...blog,
    author: authorObj ? { _id: authorObj.id, id: authorObj.id, name: authorObj.name, email: authorObj.email } : blog.author_id,
    users: undefined,
    author_id: undefined
  };
};

const createSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

// @desc    Get all approved blogs
// @route   GET /api/blogs
router.get('/', async (req, res, next) => {
  try {
    const { data: blogs, error } = await supabase
      .from('blogs')
      .select('*, users(id, name)')
      .eq('status', 'approved')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: blogs.map(sanitizeBlog) });
  } catch (err) {
    next(err);
  }
});

// @desc    Get single blog by slug
// @route   GET /api/blogs/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { data: blog, error } = await supabase
      .from('blogs')
      .select('*, users(id, name)')
      .eq('slug', req.params.slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw error;
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    res.json({ success: true, data: sanitizeBlog(blog) });
  } catch (err) {
    next(err);
  }
});

// @desc    Create a blog (User or Admin)
// @route   POST /api/blogs
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, content, excerpt, image, tag } = req.body;
    
    // If admin, it's auto-approved
    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const slug = createSlug(title);
    
    const { data: blog, error } = await supabase
      .from('blogs')
      .insert([{
        title,
        slug,
        content,
        excerpt,
        image,
        tag,
        author_id: req.user.id,
        status
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: sanitizeBlog(blog) });
  } catch (err) {
    next(err);
  }
});

// @desc    Get all blogs for admin (including pending)
// @route   GET /api/blogs/admin/all
router.get('/admin/all', auth, admin, async (req, res, next) => {
  try {
    const { data: blogs, error } = await supabase
      .from('blogs')
      .select('*, users(id, name, email)')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: blogs.map(sanitizeBlog) });
  } catch (err) {
    next(err);
  }
});

// @desc    Approve/Reject blog
// @route   PATCH /api/blogs/:id/status
router.patch('/:id/status', auth, admin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const { data: blog, error } = await supabase
      .from('blogs')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    res.json({ success: true, data: sanitizeBlog(blog) });
  } catch (err) {
    next(err);
  }
});

// @desc    Get my blogs
// @route   GET /api/blogs/my/posts
router.get('/my/posts', auth, async (req, res, next) => {
  try {
    const { data: blogs, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('author_id', req.user.id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: blogs.map(sanitizeBlog) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
