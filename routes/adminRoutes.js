const express = require("express");
const supabase = require("../config/supabase");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

const sanitizeUser = (user) => ({
  _id: user.id,
  id: user.id,
  ...user
});

// GET /api/admin/analytics - Overview metrics and charts
router.get("/analytics", auth, admin, async (req, res, next) => {
  try {
    const [{ count: totalUsers }, { count: totalProducts }, { count: totalOrders }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true })
    ]);
    
    // Fetch all products to calculate category distribution
    const { data: allProducts } = await supabase
      .from('products')
      .select('category, name, countInStock');

    const categoryDistribution = allProducts.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    const formattedCategories = Object.keys(categoryDistribution).map(name => ({
      name,
      value: categoryDistribution[name]
    }));

    // Fetch orders to calculate revenue and top products
    const { data: paidOrders, error: ordersError } = await supabase
      .from('orders')
      .select('totalPrice, paidAt, orderItems')
      .eq('isPaid', true);

    if (ordersError) throw ordersError;

    const totalRevenue = paidOrders.reduce((acc, order) => acc + Number(order.totalPrice || 0), 0);

    // Calculate Top Products
    const productSales = {};
    paidOrders.forEach(order => {
      const items = typeof order.orderItems === 'string' ? JSON.parse(order.orderItems) : order.orderItems;
      if (Array.isArray(items)) {
        items.forEach(item => {
          const name = item.name || 'Unknown';
          productSales[name] = (productSales[name] || 0) + (item.qty || 1);
        });
      }
    });

    const topProducts = Object.keys(productSales)
      .map(name => ({ name, sales: productSales[name] }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // Calculate last 7 days revenue
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentPaidOrders = paidOrders.filter(o => new Date(o.paidAt) >= sevenDaysAgo);
    
    const salesByDate = {};
    recentPaidOrders.forEach(order => {
      const dateString = new Date(order.paidAt).toISOString().split('T')[0];
      if (!salesByDate[dateString]) salesByDate[dateString] = 0;
      salesByDate[dateString] += Number(order.totalPrice);
    });

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      chartData.push({
        date: dateString,
        sales: salesByDate[dateString] || 0
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        totalRevenue,
        chartData,
        topProducts,
        categoryDistribution: formattedCategories
      }
    });
  } catch (error) {
    next(error);
  }
});



// GET /api/admin/users - List all users
router.get("/users", auth, admin, async (req, res, next) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, isVerified, createdAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: users.map(sanitizeUser)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
