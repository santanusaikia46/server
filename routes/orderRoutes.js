const express = require("express");
const supabase = require("../config/supabase");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const { orderSchema, validate } = require("../utils/validation");

const router = express.Router();

const sanitizeOrder = (order) => {
  const userObj = order.users || order.user;
  return {
    _id: order.id,
    id: order.id,
    ...order,
    user: userObj ? { _id: userObj.id, id: userObj.id, name: userObj.name, email: userObj.email } : order.user_id,
    users: undefined,
    user_id: undefined
  };
};

// POST create new order
router.post("/", auth, validate(orderSchema), async (req, res, next) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice } = req.body;

    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({ success: false, message: "No order items" });
    } else {
      const { data: createdOrder, error } = await supabase
        .from('orders')
        .insert([{
          user_id: req.user.id,
          orderItems,
          shippingAddress,
          paymentMethod,
          totalPrice,
          isPaid: false,
          isDelivered: false
        }])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: sanitizeOrder(createdOrder) });
    }
  } catch (error) {
    next(error);
  }
});

// GET logged in user orders
router.get("/myorders", auth, async (req, res, next) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', req.user.id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: orders.map(sanitizeOrder) });
  } catch (error) {
    next(error);
  }
});

// GET order by ID
router.get("/:id", auth, async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users(id, name, email)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (order) {
      // Check if user is admin or the order belongs to the user
      if (req.user.role === 'admin' || order.user_id === req.user.id) {
        res.json({ success: true, data: sanitizeOrder(order) });
      } else {
        res.status(401).json({ success: false, message: "Not authorized to view this order" });
      }
    } else {
      res.status(404).json({ success: false, message: "Order not found" });
    }
  } catch (error) {
    next(error);
  }
});

// PUT update order to paid (simulated payment)
router.put("/:id/pay", auth, async (req, res, next) => {
  try {
    // First, verify the order belongs to the user
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('user_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (findError) throw findError;
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Not authorized to pay for this order" });
    }

    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        isPaid: true,
        paidAt: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({ success: true, data: sanitizeOrder(updatedOrder) });
  } catch (error) {
    next(error);
  }
});

// GET all orders (Admin only)
router.get("/", auth, admin, async (req, res, next) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, users(id, name, email)')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: orders.map(sanitizeOrder) });
  } catch (error) {
    next(error);
  }
});

// PUT update order to delivered (Admin only)
router.put("/:id/deliver", auth, admin, async (req, res, next) => {
  try {
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        isDelivered: true,
        deliveredAt: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (updatedOrder) {
      res.json({ success: true, data: sanitizeOrder(updatedOrder) });
    } else {
      res.status(404).json({ success: false, message: "Order not found" });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
