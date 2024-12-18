const express = require("express");
const app = express();
const mongoose = require('mongoose');
const Stripe = require("stripe");

require("dotenv").config();
const Bill = require("../model/bill")
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { ObjectId } = require("mongodb");
const connectDb = require("../model/db");
const {  getEmailQueue } = require('../services/emailQueue');
const { createBillPDF } = require('../services/utils');



var router = express.Router();




(async () => {
  try {
      const db = await connectDb(); // Kết nối đến MongoDB
      console.log("Kết nối đến cơ sở dữ liệu thành công");
  } catch (error) {
      console.error("Kết nối đến cơ sở dữ liệu thất bại:", error);
  }
})();




router.post("/create-checkout-session", async (req, res) => {
  const {email, userId, couponId,discount } = req.body;

  // Kết nối cơ sở dữ liệu
  const db = await connectDb();
  const cartCollection = db.collection("cart");
  

  // Lấy giỏ hàng của người dùng từ MongoDB
  const userCart = await cartCollection.findOne({ userId: new ObjectId(userId) });

  

  if (!userCart || userCart.items.length === 0) {
    return res.status(404).json({ message: "Giỏ hàng trống" });
  }

  const customer = await stripe.customers.create({
    email: email,
    metadata: {
      userId: userId,
      cart: JSON.stringify(
        userCart.items.map(item => ({
          id: item.productId.toString(),
          name: item.name,
          image: item.image,
          size: item.size,
          quantity: item.quantity,
          price: item.price,  
          discountedPrice: item.discountedPrice,
        }))
      ),
      
    discount: discount || "0",
    coupon: couponId || "",
    },
    
  });
  

  const line_items = userCart.items.map(item => {
    // Tính giá giảm từ phần trăm nếu có discountPercent
    const discountedPrice = item.discountedPrice
      ? item.price - (item.price * item.discountedPrice) / 100
      : item.price; // Sử dụng giá gốc nếu không có giảm giá
  
    console.log("Discounted Price:", discountedPrice); // Kiểm tra giá sau khi tính giảm giá
  
    return {
      price_data: {
        currency: "vnd",
        product_data: {
          name: item.name,
          images: [item.image],
          description: item.description,
          metadata: {
            id: item.productId.toString(),
            size: item.size,
          },
        },
        unit_amount: Math.round(discountedPrice ), // Chuyển sang đơn vị cent
      },
      quantity: item.quantity,
    };
  });
  
  
  
  
  
  
  
  const session = await stripe.checkout.sessions.create({
    shipping_address_collection: {
      allowed_countries: ["US", "VN"],
    },
    phone_number_collection: {
      enabled: true, // Bật trường nhập số điện thoại
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: 0,
            currency: "vnd",
          },
          display_name: "Free shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 5 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: 1500,
            currency: "vnd",
          },
          display_name: "Next day air",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 1 },
            maximum: { unit: "business_day", value: 1 },
          },
        },
      },
    ],
    customer: customer.id,
    line_items,
    mode: "payment",
    discounts: couponId ? [{ coupon: couponId }] : [],
    success_url: `${process.env.CLIENT_URL}/checkout`,
    cancel_url: `${process.env.CLIENT_URL}/cart`,
  });

  res.send({ url: session.url });
});





// Create bill
const createBill = async (customer, data) => {
  const Items = customer.metadata.cart ? JSON.parse(customer.metadata.cart) : [];
  const email = customer.email;
  const pdfFilePath = await createBillPDF(data);
  let phone = data.customer_details.phone;
  if (phone && phone.startsWith("+")) {
    phone = phone.replace(/^\+(\d{1,4})/, "0");
  }

  const subtotal = data.amount_subtotal; // Tổng trước giảm giá
  
  
  const newBill = new Bill({
    userId: customer.metadata.userId,
    paymentIntentId: data.payment_intent,
    products: Items,
    email: email,
    subtotal: subtotal,
    total: data.amount_total,
    discount: customer.metadata.discount, // Lưu % giảm giá hoặc 0 nếu không có
    coupon: customer.metadata.coupon ,
    shipping: data.customer_details,
    phone: phone,
    payment_status: "đã thanh toán",
    order_status: "chưa giải quyết",
  });

  try {
    // Lưu hóa đơn vào MongoDB
    const savedBill = await newBill.save();
    console.log("Hóa đơn đã được lưu:", savedBill);


      // Tạo hóa đơn PDF
      const pdfFilePath = await createBillPDF(data);

 // Lấy hàng đợi email từ Redis
      const emailQueue = getEmailQueue();

      // Thêm công việc vào hàng đợi để gửi email
      await emailQueue.add('send-email', {
        userEmail: email,
        billDetails: savedBill,
        attachments: [{ path: pdfFilePath }],
      });

 console.log("Email đã được thêm vào hàng đợi.");
  } catch (err) {
    console.error("Lỗi khi tạo hóa đơn:", err);
  }
};


// stripe webhooks


let endpointSecret ;
//  endpointSecret = "whsec_2012e3ef93473c4aff8dd580bc089e5cb45645845400148bed33242726171cf3";

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let data;
  let eventType;
 

  if (endpointSecret) {
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("Webhook verified successfully");
      data = event.data.object;
      eventType = event.type;
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    data = req.body.data.object;
    eventType = req.body.type;
  }

  if (eventType === "checkout.session.completed") {
    try {
      const customer = await stripe.customers.retrieve(data.customer);
  
      // Lấy thông tin giảm giá từ metadata
      const discount = customer.metadata.discount || [];
      const coupon = customer.metadata?.coupon || 'N/A';
  
      if (discount.length > 0 && discount[0].coupon) {
        coupon = discount[0].coupon.id;
        discountPercentage = discount[0].coupon.percent_off || 0;
      }
  
      const userId = customer.metadata?.userId || null;
      const userEmail = customer.email;
  
      if (!userId || !userEmail) {
        throw new Error("Missing user ID or email in customer metadata");
      }

      // Create and store the bill
      await createBill(customer, data);
      console.log("đây là dữ liệu customer:",customer);
      console.log("đây là dữ liệu data:",data);
      
  
      //  Clear user's cart
      const db = await connectDb();
      const cartCollection = db.collection("cart");
      const productCollection = db.collection("products");
      const cart = await cartCollection.findOne({ userId: new ObjectId(userId) });
  
      if (!cart) {
        throw new Error(`Cart not found for user: ${userId}`);
      }
  
      await cartCollection.deleteOne({ userId: new ObjectId(userId) });
      console.log(`Cart cleared for user: ${userId}`);

      
      
  
      // Lặp qua các sản phẩm trong giỏ hàng và cập nhật tồn kho
      if (customer.metadata.cart) {
        const cartItems = JSON.parse(customer.metadata.cart);
        for (const item of cartItems) {
          const { id, quantity } = item;
          const product = await productCollection.findOne({ _id: new ObjectId(id) });

          if (product) {
            const newQuantity = product.quantity - quantity;
            if (newQuantity >= 0) {
              await productCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { quantity: newQuantity } }
              );
              console.log(`Product ${id} updated: new quantity ${newQuantity}`);
            } else {
              console.warn(`Not enough stock for product ${id}`);
            }
          } else {
            console.warn(`Product ${id} not found`);
          }
        }
      } else {
        console.error('No cart items found in metadata or invalid format');
      }
      
  
      
  
      const emailQueue = getEmailQueue();
  

      // Gửi email tới khách hàng

      const cartProducts = customer.metadata.cart ? JSON.parse(customer.metadata.cart) : [];
    

  

      const productsDetails = cartProducts.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        discountedPrice: product.discountedPrice,
        quantity: product.quantity,
        subtotal: product.subtotal,
        total: product.total,
        image: product.image,
        size: product.size,
      }));

      const pdfFilePath = await createBillPDF({
        payment_intent: data.payment_intent,
        amount_total: data.amount_total,
        customer_details: data.customer_details,
        products: productsDetails,
        coupon: coupon,  
      discount: discount,  
      });
      
      
      
      
      await emailQueue.add(
        'send-email',
        {
          userEmail,
          billDetails: {
            orderId: data.payment_intent,
            amount: data.amount_total,
            products: productsDetails || [],
            shippingAddress: data.customer_details?.address || {},  // this is fine
            coupon: customer.metadata.coupon || "",  // Mã giảm giá
            discount: customer.metadata.discount || 0,
            
          },
          attachments: [
            {
              filename: `invoice-${data.payment_intent}.pdf`,
              path: pdfFilePath,
            },
          ],
        },
        { attempts: 3, backoff: 5000 }
      );
      console.log(`Email thông báo của khách hàng đã được xếp hàng đợi ${userEmail}`);
  
      // 4. Gửi email thông báo cho admin
      const adminEmail = 'fashionverse112@gmail.com'; // Thay bằng email admin thực tế
      await emailQueue.add(
        'send-admin-email',
        {
          adminEmail,
          orderDetails: {
            orderId: data.payment_intent,
            customerName: data.customer_details.name || 'Không có tên',
            customerEmail: customer.email,
            amount: data.amount_total ,
            products: productsDetails || [],
            shippingAddress: data.customer_details?.address || {},
            coupon: customer.metadata.coupon || "",  // Mã giảm giá
            discount: customer.metadata.discount || 0,
          },
        },
        { attempts: 3, backoff: 5000 }
      );
      console.log(`Email thông báo đơn hàng mới đã được xếp hàng đợi cho admin: ${adminEmail}`);
      
  
    } catch (err) {
      console.error("Error processing checkout.session.completed:", err.message);
    }
  }
  

  res.status(200).end();
});




// --------------------------------------------------------------- mã giảm giá

router.post("/apply-coupon", async (req, res) => {
  const { couponCode, totalAmount } = req.body; // totalAmount in dollars

  try {
    // Kiểm tra mã giảm giá với Stripe
    const coupon = await stripe.coupons.retrieve(couponCode);

    // Kiểm tra xem mã giảm giá có hợp lệ không và chưa hết hạn
    if (!coupon || (coupon.redeem_by && new Date(coupon.redeem_by * 1000) < new Date())) {
      return res.status(400).json({ valid: false, message: "Mã giảm giá không hợp lệ hoặc đã hết hạn." });
    }

    // Kiểm tra xem mã giảm giá có phần trăm giảm giá hay không
    if (coupon.percent_off) {
      // Tính toán giá trị giảm giá nếu là giảm theo phần trăm
      const discountAmount = totalAmount * (coupon.percent_off / 100); // Calculate the discount in dollars
      const discountInCents = Math.round(discountAmount * 100); // Convert to cents

      // Tính toán tổng tiền sau khi áp dụng giảm giá
      const totalInCents = Math.round(totalAmount * 100); // Convert total to cents
      const finalAmount = totalInCents - discountInCents;

      res.status(200).json({
        valid: true,
        discountDetails: {
          couponId: coupon.id,
          discountType: "percent",
          discountValue: discountInCents / 100, // Convert back to dollars for display
          finalAmount: finalAmount / 100, // Convert final amount to dollars for display
        },
      });
    } else if (coupon.amount_off) {
      // Tính toán giá trị giảm giá nếu là giảm theo số tiền cố định
      const discountInCents = coupon.amount_off; // amount_off is already in cents
      const totalInCents = Math.round(totalAmount * 100); // Convert total to cents
      const finalAmount = totalInCents - discountInCents;

      res.status(200).json({
        valid: true,
        discountDetails: {
          couponId: coupon.id,
          discountType: "amount",
          discountValue: discountInCents / 100, // Convert to dollars for display
          finalAmount: finalAmount / 100, // Convert final amount to dollars for display
        },
      });
    } else {
      return res.status(400).json({ valid: false, message: "Mã giảm giá không hợp lệ." });
    }

  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ valid: false, message: "Có lỗi xảy ra khi xử lý mã giảm giá." });
  }
});

//-------------------------------------- thống kê đơn hàng 







router.get('/revenue/statistics', async (req, res) => {
  try {
    const db = await connectDb();
    const ordersCollection = db.collection("bills");

    // Lọc chỉ những hóa đơn "đã thanh toán"
    const paidBills = await ordersCollection.find({ payment_status: "đã thanh toán" }).toArray();

    // Tính tổng doanh thu
    const totalRevenue = paidBills.reduce((acc, bill) => acc + bill.total, 0);

    // Doanh thu theo ngày
    const revenueByDate = paidBills.reduce((acc, bill) => {
      const date = new Date(bill.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
      acc[date] = (acc[date] || 0) + bill.total;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      totalRevenue,
      revenueByDate,
    });
  } catch (err) {
    console.error("Error fetching revenue statistics:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});
// --------------------------------------------------------------- Hiển Thị hóa đơn của admin

router.get('/admin/orders', async (req, res) => {
  try {
    const bills = await Bill.find({})
    .sort({ createdAt: -1 });  // Lấy tất cả hóa đơn
    res.status(200).json(bills);
  } catch (err) {
    console.error("Error fetching all bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/admin/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Bill.findById(orderId); 
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json(order);
  } catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.put('/admin/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { order_status } = req.body;  // Lấy trạng thái mới từ body request
  
  // Kiểm tra trạng thái đơn hàng hợp lệ
  if (!['chưa giải quyết', 'đã vận chuyển', 'đã giao hàng', 'đã hủy'].includes(order_status)) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  try {
    const updateData = { order_status };
    if (order_status === "đã hủy") {
      updateData.payment_status = "đã hoàn tiền";
    }
    const updatedBill = await Bill.findByIdAndUpdate(
      orderId,
      updateData,
      { order_status },  // Cập nhật trạng thái giao hàng
      { new: true }       // Trả về bản ghi mới sau khi cập nhật
    );
    
    if (!updatedBill) {
      return res.status(404).json({ message: "Order not found" });
    }


    res.status(200).json(updatedBill);
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/adminpay/orders', async (req, res) => {
  const { payment_status, order_status } = req.query;  // Lấy các tham số từ query string

  let filter = {};  // Filter mặc định là tất cả hóa đơn

  if (payment_status) {
    filter.payment_status = payment_status;  // Lọc theo trạng thái thanh toán
  }

  if (order_status) {
    filter.order_status = order_status;  // Lọc theo trạng thái đơn hàng
  }

  try {
    const bills = await Bill.find(filter);  // Lấy hóa đơn theo điều kiện lọc
    res.status(200).json(bills);
  } catch (err) {
    console.error("Error fetching bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// --------------------------------------------------------------- Hiển Thị hóa đơn của người dùng



router.get("/orderuser/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const db = await connectDb(); 
    const ordersCollection = db.collection("bills");
    const orders = await ordersCollection.find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/orders/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  try {
    const db = await connectDb(); 
    const ordersCollection = db.collection("bills");
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ message: "Server error" });
  }
});








module.exports = router;