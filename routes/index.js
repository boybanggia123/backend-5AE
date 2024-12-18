const functions = require("firebase-functions");
const express = require("express");
var router = express.Router();
const cors = require("cors");
const app = express();
app.use(cors());
const nodemailer = require("nodemailer");
const connectDb = require("../model/db");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const multer = require('multer');
const crypto = require('crypto');
const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();
cloudinary.config({
  cloud_name: "dwrp82bhy",
  api_key: "667485257866548",
  api_secret: "DkqnpV-tBbyoAOxWz4ORdfLIhi8",
});
//-----------------------------------------------Upload img--------------------------------------------------------
//Thiết lập nơi lưu trữ và tên file
const storage = multer.memoryStorage(); // Chuyển sang memory storage để dễ dàng upload lên Cloudinary
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return cb(new Error("Bạn chỉ được upload file ảnh"));
    }
    cb(null, true);
  },
});
//-----------------------------------------------end Upload img--------------------------------------------------------
//-------------------------------------------------BÌNH LUẬN VÀ ĐÁNH GIÁ--------------------------------------------------------------


// Lấy bình luận
router.get("/productreviews/:id", async (req, res) => {
  const productId = req.params.id;

  // Kiểm tra nếu productId là một ObjectId hợp lệ
  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
  }

  try {
    const db = await connectDb();
    const reviewsCollection = db.collection("reviews");
    const reviews = await reviewsCollection.find({ productId: new ObjectId(productId) }).toArray();

    if (reviews.length === 0) {
      return res.status(404).json({ message: "Không có bình luận cho sản phẩm này" });
    }

    res.status(200).json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi lấy bình luận" });
  }
});
// thêm bình luận
router.post("/productreview/:id", async (req, res, next) => {
  const productId = new ObjectId(req.params.id);
  const { userId, rating, comment } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!userId || !rating || !comment) {
    return res.status(400).json({ message: "Thiếu thông tin bình luận hoặc đánh giá" });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Đánh giá phải trong phạm vi từ 1 đến 5" });
  }

  const db = await connectDb();
  const reviewsCollection = db.collection("reviews"); // Collection reviews
  const productsCollection = db.collection("products"); // Collection products
  const userCollection = db.collection("users");

  try {
    // Lấy thông tin người dùng
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
    const existingReview = await reviewsCollection.findOne({ productId, userId: new ObjectId(userId) });
    if (existingReview) {
      return res.status(400).json({ message: "Bạn chỉ được đánh giá sản phẩm này 1 lần" });
    }

    // Tạo đối tượng bình luận mới
    const newReview = {
      productId: productId,
      userId: new ObjectId(userId),
      userName: user.fullname,
      userImage: user.avatar,
      rating,
      comment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Thêm bình luận vào collection reviews
    const result = await reviewsCollection.insertOne(newReview);

    // Nếu thêm bình luận thành công, cập nhật lại thông tin sản phẩm (tính lại số sao trung bình)
    if (result.insertedId) {
      // Tính lại số sao trung bình của sản phẩm
      const reviews = await reviewsCollection.find({ productId }).toArray();
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

      // Cập nhật lại rating trung bình của sản phẩm
      await productsCollection.updateOne(
        { _id: productId },
        { $set: { averageRating: averageRating } }
      );

      // Trả về dữ liệu bình luận vừa được thêm và số sao trung bình mới
      res.status(200).json({
        message: "Bình luận và đánh giá đã được thêm thành công",
        review: newReview, // Trả về bình luận mới nhất
        averageRating: averageRating // Trả về số sao trung bình mới nhất
      });
    } else {
      res.status(500).json({ message: "Lỗi khi thêm bình luận" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// Xóa bình luận
router.delete("/productreview/:productId/:reviewId", async (req, res) => {
  const { productId, reviewId } = req.params;

  // Kiểm tra nếu productId và reviewId có phải là ObjectId hợp lệ không
  if (!ObjectId.isValid(productId) || !ObjectId.isValid(reviewId)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }

  const db = await connectDb();
  const reviewsCollection = db.collection("reviews");

  try {
    // Xóa bình luận theo productId và reviewId
    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(reviewId),
      productId: new ObjectId(productId),
    });

    if (result.deletedCount > 0) {
      res.status(200).json({ message: "Bình luận đã được xóa thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy bình luận" });
    }
  } catch (error) {
    console.error("Lỗi khi xóa bình luận:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// Cập nhật bình luận
router.put("/productreview/:productId/:reviewId", async (req, res) => {
  const { productId, reviewId } = req.params;
  const { userId, rating, comment } = req.body;

  // Kiểm tra tính hợp lệ của productId và reviewId
  if (!ObjectId.isValid(productId) || !ObjectId.isValid(reviewId)) {
    return res.status(400).json({ message: "ID sản phẩm hoặc ID bình luận không hợp lệ" });
  }

  // Kiểm tra dữ liệu đầu vào
  if (!userId || !rating || !comment) {
    return res.status(400).json({ message: "Thiếu thông tin cần thiết để cập nhật bình luận" });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Đánh giá phải trong phạm vi từ 1 đến 5" });
  }

  const db = await connectDb();
  const reviewsCollection = db.collection("reviews");
  const productsCollection = db.collection("products");

  try {
    // Tìm bình luận cần chỉnh sửa
    const review = await reviewsCollection.findOne({ _id: new ObjectId(reviewId), productId: new ObjectId(productId) });
    
    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy bình luận" });
    }

    // Kiểm tra quyền chỉnh sửa (người dùng phải là người đã tạo bình luận)
    if (review.userId.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa bình luận này" });
    }

    // Cập nhật bình luận
    const updatedReview = {
      rating,
      comment,
      updatedAt: new Date()
    };

    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(reviewId) },
      { $set: updatedReview }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: "Không thể cập nhật bình luận" });
    }

    // Tính lại số sao trung bình của sản phẩm
    const reviews = await reviewsCollection.find({ productId: new ObjectId(productId) }).toArray();
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    // Cập nhật lại rating trung bình của sản phẩm
    await productsCollection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { averageRating: averageRating } }
    );

    // Trả về thông tin bình luận đã được cập nhật và số sao trung bình mới nhất
    res.status(200).json({ 
      message: "Bình luận đã được cập nhật thành công", 
      review: { ...review, ...updatedReview }, 
      averageRating: averageRating 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi cập nhật bình luận" });
  }
});

// -----------------------------------------------END ĐÁNH GIÁ VÀ BÌNH LUẬN-----------------------------------------------------------
// ---------------------------------------------------PRODUCTS------------------------------------------------------------------
//Lấy tất cả sản phẩm dạng json
router.get("/products", async (req, res, next) => {
  const db = await connectDb();
  const productCollection = db.collection("products");
  
  // Khởi tạo điều kiện tìm kiếm
  const query = {};
  
  // Kiểm tra xem categoryId có trong query parameters không
  if (req.query.categoryId) {
    query.categoryId = new ObjectId(req.query.categoryId);
  }
  
  // Lấy sản phẩm theo điều kiện
  const products = await productCollection.find(query).toArray();
  
  if (products.length > 0) {
    res.status(200).json(products);
  } else {
    res.status(404).json({ message: "Không tìm thấy sản phẩm" });
  }
});

router.get("/related-products", async (req, res, next) => {
  try {
    const { productId } = req.query; // Lấy productId từ query parameters
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const db = await connectDb();
    const productCollection = db.collection("products");

    // Lấy thông tin sản phẩm dựa trên productId
    const product = await productCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Tìm các sản phẩm cùng danh mục (hoặc các thuộc tính khác tương tự)
    const relatedProducts = await productCollection.find({
      categoryId: product.categoryId, // Có thể thay đổi theo cách bạn xác định sản phẩm liên quan
      _id: { $ne: new ObjectId(productId) } // Đảm bảo sản phẩm hiện tại không được lấy lại
    }).toArray();

    if (relatedProducts.length > 0) {
      res.status(200).json(relatedProducts);
    } else {
      res.status(404).json({ message: "No related products found" });
    }
  } catch (error) {
    next(error);
  }
});

//lấy sản phẩm hot
router.get("/hot", async (req, res, next) => {
  try {
    const db = await connectDb();
    const productCollection = db.collection("products");

    const products = await productCollection
      .find({ hot: true })
      .limit(4)
      .toArray();

    if (products.length > 0) {
      res.status(200).json(products);
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm hot" });
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    next(error);
  }
});
// tìm kiếm sản phẩm 
router.get('/search', async function (req, res, next) {
  try {
    const searchKey = req.query.key;
    if (!searchKey) {
      return res.status(400).json({ message: 'Search key is required' });
    }
    const db = await connectDb();
    const productCollection = db.collection('products');
    const regex = new RegExp(searchKey, 'i');
    const products = await productCollection
      .find({
        $or: [{ name: { $regex: regex } }, { description: { $regex: regex } }],
      })
      .toArray();
    if (products.length > 0) {
      res.status(200).json(products);
    } else {
      res.status(404).json({ message: 'No products found' });
    }
  } catch (error) {
    next(error);
  }
});
// lấy sản phẩm mới
router.get("/new", async (req, res, next) => {
  try {
    const db = await connectDb();
    const productCollection = db.collection("products");

    // Lấy ngày hiện tại và ngày cách đây 30 ngày
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 30);

    // Tìm các sản phẩm có `dayadd` nằm trong khoảng 30 ngày gần đây
    const products = await productCollection
      .find({ dayadd: { $gte: pastDate } })

      .toArray();

    if (products.length > 0) {
      res.status(200).json(products);
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm mới" });
    }
  } catch (error) {
    console.error("Error fetching new products:", error);
    next(error);
  }
});
// lấy sản phẩm theo danh mục
router.get("/products/:categoryId", async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const db = await connectDb();
    const productCollection = db.collection("products");
    const query = { categoryId: ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : categoryId };
    const products = await productCollection.find(query).toArray();
    if (products.length > 0) {
      res.status(200).json(products);
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm cho danh mục này" });
    }
  } catch (error) {
    console.error("Error fetching products by categoryId:", error);
    next(error);
  }
});

// Lấy danh sách danh mục
router.get("/categories", async (req, res, next) => {
  try {
    const db = await connectDb(); // Sử dụng connectDb để kết nối với cơ sở dữ liệu
    const categoryCollection = db.collection("categories");
    const categories = await categoryCollection.find().toArray();
    if (categories.length > 0) {
      res.status(200).json(categories);
    } else {
      res.status(404).json({ message: "Không có danh mục nào" });
    }
  } catch (error) {
    next(error);
  }
});

//Lấy danh mục taikhoan
router.get("/users", async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection("users");
  const users = await userCollection.find().toArray();
  if (users) {
    res.status(200).json(users);
  } else {
    res.status(404).json({ message: "Không tìm thấy" });
  }
});


//lấy chi tiết 1 sản phẩm
router.get("/productdetail/:id", async (req, res, next) => {
  let id = new ObjectId(req.params.id);
  const db = await connectDb();
  const productCollection = db.collection("products");
  const product = await productCollection.findOne({ _id: id });
  if (product) {
    res.status(200).json(product);
  } else {
    res.status(404).json({ message: "Không tìm thấy" });
  }
});
// API lấy bình luận của sản phẩm
router.get("/productreviews/:id", async (req, res, next) => {
  let id = new ObjectId(req.params.id);
  const db = await connectDb();
  const productCollection = db.collection("products");
  const product = await productCollection.findOne({ _id: id });

  if (product && product.reviews) {
    res.status(200).json(product.reviews);
  } else {
    res.status(404).json({ message: "Không tìm thấy bình luận" });
  }
});

// Lấy sản phẩm liên quan
router.get("/related-products/:id", async (req, res, next) => {
  try {
    const productId = new ObjectId(req.params.id);
    const db = await connectDb();
    const productCollection = db.collection("products");

    // Tìm sản phẩm hiện tại để lấy categoryId
    const currentProduct = await productCollection.findOne({ _id: productId });

    if (!currentProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm hiện tại" });
    }

    // Tìm các sản phẩm liên quan cùng categoryId nhưng khác _id
    const relatedProducts = await productCollection
      .find({
        categoryId: currentProduct.categoryId,
        _id: { $ne: productId }, // Loại bỏ sản phẩm hiện tại
      })
      .toArray();

    if (relatedProducts.length > 0) {
      res.status(200).json(relatedProducts);
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm liên quan" });
    }
  } catch (error) {
    console.error("Lỗi khi lấy sản phẩm liên quan:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// ------------------------------------------END PRODUCTS------------------------------------------------------------------

// ------------------------------------------------CART----------------------------------------------------------
// Thêm sản phẩm vào giỏ hàng
router.post("/cart", async (req, res, next) => {
    const { userId, productId, quantity, size } = req.body;
    // Kiểm tra dữ liệu hợp lệ
    if (!userId || !productId || !quantity || !size) {
      return res.status(400).json({ message: "Thiếu thông tin giỏ hàng" });
    }
    // Kiểm tra số lượng phải lớn hơn 0
    if (quantity <= 0) {
      return res.status(400).json({ message: "Số lượng phải lớn hơn 0" });
    }
    const db = await connectDb();
    const cartCollection = db.collection("cart");
    const productCollection = db.collection("products");
    // Lấy thông tin sản phẩm từ collection products
    const product = await productCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Thông tin sản phẩm cần lưu vào giỏ hàng, bao gồm tên, giá, và giá đã giảm
    const productInfo = {
      productId: new ObjectId(productId),
      image: product.image,
      name: product.name,         // Thêm tên sản phẩm
      price: product.price,       // Thêm giá sản phẩm
      discountedPrice: product.discountedPrice , // Thêm giá đã giảm (nếu có)
      size: size,
      quantity: quantity,
    };

    const existingCart = await cartCollection.findOne({ userId: new ObjectId(userId) });

    if (existingCart) {
      // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
      const productIndex = existingCart.items.findIndex(item => 
        item.productId.toString() === productId && item.size === size
      );
      
      if (productIndex !== -1) {
        // Nếu có, cập nhật số lượng
        existingCart.items[productIndex].quantity += quantity;
        await cartCollection.updateOne(
          { userId: new ObjectId(userId) },
          { $set: { items: existingCart.items } }
        );
        return res.status(200).json({ message: "Cập nhật sản phẩm trong giỏ hàng thành công" });
      } else {
        // Nếu không có, thêm sản phẩm mới vào giỏ hàng
        existingCart.items.push(productInfo);
        await cartCollection.updateOne(
          { userId: new ObjectId(userId) },
          { $set: { items: existingCart.items } }
        );
        return res.status(200).json({ message: "Thêm sản phẩm vào giỏ hàng thành công" });
      }
    } else {
      // Nếu không có giỏ hàng, tạo mới giỏ hàng cho người dùng
      const newCart = {
        userId: new ObjectId(userId),
        items: [productInfo],
      };
      await cartCollection.insertOne(newCart);
      return res.status(201).json({ message: "Tạo giỏ hàng mới và thêm sản phẩm thành công" });
    }
});
// Lấy giỏ hàng của người dùng
router.get("/cart/:userId", async (req, res, next) => {
    const userId = req.params.userId;
    const db = await connectDb();
    const cartCollection = db.collection("cart");
    const cart = await cartCollection.findOne({ userId: new ObjectId(userId) });
    
    if (cart) {
      res.status(200).json(cart.items);
    } else {
      res.status(404).json({ message: "Không tìm thấy giỏ hàng cho người dùng này" });
    }
});
// Xóa sản phẩm khỏi giỏ hàng
router.delete("/cart", async (req, res, next) => {
  const {userId, productId, size } = req.body; // lấy thông tin sản phẩm và size từ body

  // Kiểm tra dữ liệu hợp lệ
  if (!userId ||!productId || !size) {
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm hoặc kích thước" });
  }

  const db = await connectDb();
  const cartCollection = db.collection("cart");

  // Tìm giỏ hàng của người dùng
  const existingCart = await cartCollection.findOne({ userId: new ObjectId(userId) });

  if (existingCart) {
      // Tìm sản phẩm trong giỏ hàng
      const productIndex = existingCart.items.findIndex(item => 
          item.productId.toString() === productId && item.size === size
      );

      if (productIndex !== -1) {
          // Xóa sản phẩm nếu tìm thấy
          existingCart.items.splice(productIndex, 1);
          await cartCollection.updateOne(
              { userId: new ObjectId(userId) },
              { $set: { items: existingCart.items } }
          );

          return res.status(200).json({ message: "Xóa sản phẩm khỏi giỏ hàng thành công" });
      } else {
          return res.status(404).json({ message: "Sản phẩm không tồn tại trong giỏ hàng" });
      }
  } else {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng cho người dùng này" });
  }
});
// Cập nhật sản phẩm trong giỏ hàng
router.put("/cart", async (req, res, next) => {
  const { userId, productId, size, quantity } = req.body;

  // Kiểm tra dữ liệu hợp lệ
  if (!userId || !productId || !size || !quantity) {
    return res.status(400).json({ message: "Thiếu thông tin giỏ hàng" });
  }

  // Kiểm tra số lượng phải lớn hơn 0
  if (quantity <= 0) {
    return res.status(400).json({ message: "Số lượng phải lớn hơn 0" });
  }

  const db = await connectDb();
  const cartCollection = db.collection("cart");

  // Tìm giỏ hàng của người dùng
  const existingCart = await cartCollection.findOne({ userId: new ObjectId(userId) });

  if (existingCart) {
    // Tìm sản phẩm trong giỏ hàng
    const productIndex = existingCart.items.findIndex(item => 
      item.productId.toString() === productId && item.size === size
    );

    if (productIndex !== -1) {
      // Nếu tìm thấy sản phẩm trong giỏ hàng, cập nhật số lượng
      existingCart.items[productIndex].quantity = quantity;

      // Cập nhật lại giỏ hàng trong database
      await cartCollection.updateOne(
        { userId: new ObjectId(userId) },
        { $set: { items: existingCart.items } }
      );

      return res.status(200).json({ message: "Cập nhật sản phẩm trong giỏ hàng thành công" });
    } else {
      return res.status(404).json({ message: "Sản phẩm không tồn tại trong giỏ hàng" });
    }
  } else {
    return res.status(404).json({ message: "Không tìm thấy giỏ hàng cho người dùng này" });
  }
});

router.delete("/carts/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectDb();
    const cartCollection = db.collection("cart");

    // Xóa giỏ hàng của người dùng
    const result = await cartCollection.deleteOne({ userId: new ObjectId(userId) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Đã xóa giỏ hàng thành công." });
    } else {
      res.status(404).json({ message: "Không tìm thấy giỏ hàng để xóa." });
    }
  } catch (error) {
    console.error("Error deleting cart:", error);
    res.status(500).json({ message: "Lỗi khi xóa giỏ hàng." });
  }
});


// ------------------------------------------------END CART-----------------------------------------------------------
// ----------------------------------------------USERS--------------------------------------------------------------
// Đăng nhập
const jwt = require("jsonwebtoken");//Kiểm tra token qua Bearer
router.get("/checktoken", async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, "secret", (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    res.status(200).json({ message: "Token hợp lệ" });
  });
});
const { resolve } = require("path");
//dang nhap
router.post("/login", async (req, res, next) => {
  try {
    const db = await connectDb();
    const userCollection = db.collection("users");
    const { email, password } = req.body;

    // Kiểm tra nếu thiếu trường email hoặc password
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu" });
    }

    // Kiểm tra người dùng
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại" });
    }

    // Kiểm tra mật khẩu
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Mật khẩu không chính xác" });
    }

    // Tạo token với thông tin người dùng
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, fullname: user.fullname },
      process.env.JWT_SECRET || "secret", // Sử dụng biến môi trường cho JWT_SECRET
      { expiresIn: "1h" }
    );

    // Trả về token và các thông tin cần thiết khác
    res.status(200).json({
      token,
      user: {
        userId: user._id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
      },
      message: "Đăng nhập thành công",
    });
  } catch (error) {
    console.error("Đã xảy ra lỗi khi đăng nhập:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng nhập" });
  }
});

router.put("/user/update", upload.single("avatar"), async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token không được cung cấp hoặc không hợp lệ" });
    }

    const token = authorization.split(" ")[1];
    jwt.verify(token, "secret", async (err, decoded) => {
      if (err) {
        console.error("JWT Verify Error:", err);
        return res.status(401).json({ message: "Token không hợp lệ" });
      }

      if (!ObjectId.isValid(decoded.userId)) {
        return res.status(400).json({ message: "Token không chứa userId hợp lệ" });
      }
      const userId = new ObjectId(decoded.userId);

      const db = await connectDb();
      if (!db) {
        console.error("Kết nối MongoDB thất bại");
        return res.status(500).json({ message: "Không thể kết nối tới cơ sở dữ liệu" });
      }

      const userExists = await db.collection("users").findOne({ _id: userId });
      

      if (!userExists) {
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }

      console.log("Request Body:", req.body);
      const { fullname, phone, email, address, gender, dateOfBirth } = req.body;
      const updateFields = {};

      if (fullname) updateFields.fullname = fullname;
      if (phone) updateFields.phone = phone;
      if (email) updateFields.email = email;
      if (address) updateFields.address = address;
      if (gender !== undefined) updateFields.gender = gender;
      if (dateOfBirth) updateFields.dateOfBirth = dateOfBirth;

      if (req.file) {
        try {
          const avatarUrl = await cloudinaryUpload(req.file.buffer);
          console.log("Cloudinary Upload URL:", avatarUrl);
          updateFields.avatar = avatarUrl;
        } catch (cloudinaryError) {
          console.error("Lỗi khi tải ảnh lên Cloudinary:", cloudinaryError);
          return res.status(500).json({ message: "Lỗi khi tải ảnh lên Cloudinary" });
        }
      }


      const updatedUser = await db.collection("users").findOneAndUpdate(
        { _id: userId },
        { $set: updateFields },
        { returnDocument: "after" }
      );
      
      // Kiểm tra nếu cập nhật thất bại
      if (!updatedUser.value) {
        // Gửi truy vấn tìm lại để kiểm tra trạng thái cập nhật
        const checkUser = await db.collection("users").findOne({ _id: userId });
        if (!checkUser) {

          return res.status(404).json({ message: "Người dùng không tồn tại hoặc không hợp lệ" });
        } else {
          console.log("Cập nhật thành công nhưng không thể lấy dữ liệu đã cập nhật.");
          return res.status(200).json({
            message: "Cập nhật thành công",
            updatedUser: checkUser,
          });
        }
      }
      

    
      res.status(200).json({
        message: "Cập nhật thông tin thành công",
        updatedUser: updatedUser.value,
      });
    });
  } catch (error) {
    console.error("Lỗi cập nhật thông tin:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});




//lấy chi tiết 1 tài khoản
router.get('/userdetail/:id', async(req, res, next)=> {
  let id = new ObjectId(req.params.id);
  const db = await connectDb();
  const userCollection = db.collection('users');
  const user = await userCollection.findOne({_id:id});
  if(user){
    res.status(200).json(user);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);

//lấy thông tin chi tiết user qua token
router.get("/detailuser", async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, "secret", async (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    const db = await connectDb();
    const userCollection = db.collection("users");
    const userInfo = await userCollection.findOne({ email: user.email });
    if (userInfo) {
      res.status(200).json(userInfo);
    } else {
      res.status(404).json({ message: "Không tìm thấy user" });
    }
  });
});

// Đăng ký
router.post("/register", upload.single('avatar'), async (req, res) => {
  const db = await connectDb();
  const userCollection = db.collection("users");
  const { fullname, email, phone, password, dateOfBirth } = req.body;


  // Kiểm tra và cập nhật avatar nếu có file được tải lên
  let avatar = req.file ? req.file.filename : null; // Nếu có file ảnh thì lưu tên file avatar

  // Lấy thời gian hiện tại cho trường createdAt
  const createdAt = new Date().toISOString().split('T')[0];

  try {
    const user = await userCollection.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // Mã hóa mật khẩu
    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = {
      avatar,
      fullname,
      email,
      phone,
      dateOfBirth,
      password: hashPassword,
      role: "user", // Mặc định là "user"
      createdAt, // Thêm trường createdAt
    };

    // Thêm người dùng vào cơ sở dữ liệu
    const result = await userCollection.insertOne(newUser);
    if (result.insertedId) {
      res.status(200).json({ message: "Đăng ký thành công" });
    } else {
      res.status(500).json({ message: "Đăng ký thất bại" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});
// sửa tài khoản
router.put('/updateuser/:id', upload.single('avatar'), async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const id = new ObjectId(req.params.id);

  try {
    // Lấy thông tin tài khoản hiện tại từ database
    const existingUser = await userCollection.findOne({ _id: id });
    if (!existingUser) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Chuẩn bị đối tượng updatedUser với dữ liệu mới hoặc dữ liệu cũ nếu không có dữ liệu mới
    const { fullname, email, phone, address, createdAt, role, dateOfBirth, password } = req.body;
    
    let updatedUser = {
      avatar: existingUser.avatar, // Giữ avatar cũ nếu không có file ảnh mới
      fullname: fullname || existingUser.fullname,
      email: email || existingUser.email,
      phone: phone || existingUser.phone,
      address: address || existingUser.address,
      createdAt: createdAt || existingUser.createdAt,
      role: role || existingUser.role,
      dateOfBirth: dateOfBirth || existingUser.dateOfBirth,
      password: existingUser.password, // Giữ password cũ nếu không cập nhật mới
    };

    // Cập nhật avatar nếu có file mới được tải lên
    if (req.file) {
      updatedUser.avatar = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "user_avatars" },
          (error, result) => {
            if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    }

    // Mã hóa mật khẩu mới nếu có thay đổi
    if (password) {
      updatedUser.password = await bcrypt.hash(password, 10);
    }

    // Thực hiện cập nhật vào database
    const result = await userCollection.updateOne({ _id: id }, { $set: updatedUser });
    if (result.matchedCount) {
      res.status(200).json({ message: "Sửa tài khoản thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

// Thêm tài khoản
router.post("/adduser", upload.single('avatar'), async (req, res) => {
  const db = await connectDb();
  const userCollection = db.collection("users");
  const { fullname, email, phone, address, createdAt, role, dateOfBirth, password } = req.body;
  // Kiểm tra và cập nhật avatar nếu có file được tải lên
  // let avatar = req.file ? req.file.filename : null; // Sử dụng filename để lưu vào DB
  try {
    let imageUrl = "";
    if(req.file){
      imageUrl = await new Promise((resolve, reject)=>{
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "product_images" },
          (error, result) => {
            if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    }
    const user = await userCollection.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = {
      avatar: imageUrl,
      fullname,
      email,
      phone,
      address,
      createdAt,
      role: role || "user", // Mặc định là "user" nếu không có role
      dateOfBirth,
      password: hashPassword,
    };

    // Thêm người dùng vào cơ sở dữ liệu
    const result = await userCollection.insertOne(newUser);
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm tài khoản thành công" });
    } else {
      res.status(500).json({ message: "Thêm tài khoản thất bại" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

//xóa tài khoản
router.delete('/deleteuser/:id', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const id = new ObjectId(req.params.id);
  try {
    const result = await userCollection.deleteOne({ _id: id });
    if (result.deletedCount) {
      res.status(200).json({ message: "Xóa tài khoản thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

const cloudinaryUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "user_avatars" },
      (error, result) => {
        if (error) {
          console.error("Lỗi khi tải ảnh lên Cloudinary:", error);
          reject(new Error("Lỗi khi tải ảnh lên Cloudinary"));
        } else {
          resolve(result.secure_url); // Trả về URL của ảnh
        }
      }
    ).end(buffer); // Ghi buffer vào Cloudinary
  });
};




// ---------------------------------------------END USERS--------------------------------------------------------------



// ----------------------------------------------Quên mật khẩu--------------------------------------------------------------//

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "fashionverse112@gmail.com",  // Thay bằng email của bạn
    pass: "xczyubpahutsqivm",   // Mật khẩu email của bạn
  },
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("Email nhận được từ client:", email);

  // Kiểm tra xem email có tồn tại trong cơ sở dữ liệu không
  const db = await connectDb();
  const userCollection = db.collection("users");
  const user = await userCollection.findOne({ email });
  console.log(user);

  if (!user) {
    return res.status(404).json({ message: "Email không tồn tại" });
  }

  // Tạo mã OTP (hoặc token để bảo mật)
  const otp = Math.floor(100000 + Math.random() * 900000);  // Mã OTP 6 chữ số

  // Gửi mã OTP qua email
  const mailOptions = {
    from: "fashionverse112@gmail.com",
    to: email,
    subject: "Mã OTP đặt lại mật khẩu",
    html: `<p>Mã OTP của bạn là: <strong>${otp}</strong></p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error:", error);
      return res.status(500).json({ message: "Có lỗi xảy ra khi gửi email" });
    } else {
      // Lưu mã OTP tạm thời trong cơ sở dữ liệu hoặc bộ nhớ tạm
      // Ví dụ: bạn có thể lưu trong một bảng riêng hoặc bộ nhớ tạm để so sánh khi người dùng nhập mã
      userCollection.updateOne({ email }, { $set: { otp } });
      res.status(200).json({ message: "Mã OTP đã được gửi đến email của bạn" });
    }
  });
});

// Endpoint kiểm tra mã OTP
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  // Kiểm tra xem email có tồn tại trong cơ sở dữ liệu không
  const db = await connectDb();
  const userCollection = db.collection("users");
  const user = await userCollection.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "Email không tồn tại" });
  }

  // Kiểm tra mã OTP
  if (user.otp !== parseInt(otp, 10)) {
    return res.status(400).json({ message: "Mã OTP không chính xác" });
  }

  // Nếu mã OTP hợp lệ, cho phép thay đổi mật khẩu
  res.status(200).json({ message: "Mã OTP hợp lệ. Bạn có thể thay đổi mật khẩu." });
});

// Endpoint thay đổi mật khẩu
router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  // Kiểm tra xem email có tồn tại trong cơ sở dữ liệu không
  const db = await connectDb();
  const userCollection = db.collection("users");
  const user = await userCollection.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "Email không tồn tại" });
  }

  // Mã hóa mật khẩu mới trước khi lưu vào cơ sở dữ liệu
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Cập nhật mật khẩu mới cho người dùng
  await userCollection.updateOne({ email }, { $set: { password: hashedPassword, otp: null } });

  res.status(200).json({ message: "Mật khẩu đã được thay đổi thành công" });
});

// ----------------------------------------------Quên mật khẩu--------------------------------------------------------------//

// ----------------------------------------------START USERINFO--------------------------------------------------------------




// ----------------------------------------------END USERINFO--------------------------------------------------------------
// -------------------------------------------------CATEGORIES-----------------------------------------------------------

//lấy chi tiết 1 danh mục
router.get('/categorydetail/:id', async(req, res, next)=> {
  let id = new ObjectId(req.params.id);
  const db = await connectDb();
  const categoryCollection = db.collection('categories');
  const category = await categoryCollection.findOne({_id:id});
  if(category){
    res.status(200).json(category);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);


//xoa danh mục
router.delete('/deletecategory/:id', async (req, res, next) => {
  const db = await connectDb();
  const categoryCollection = db.collection('categories');
  const id = new ObjectId(req.params.id);
  try {
    const result = await categoryCollection.deleteOne({ _id: id });
    if (result.deletedCount) {
      res.status(200).json({ message: "Xóa danh mục thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy danh mục" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});
//Sửa danh mục
router.put('/updatecategory/:id', async (req, res, next) => {
  const db = await connectDb();
  const categoryCollection = db.collection('categories');
  const id = new ObjectId(req.params.id);
  const { name, description } = req.body;
  let updatedCategory = { name , description }; 
  try {
    const result = await categoryCollection.updateOne({ _id: id }, { $set: updatedCategory });
    if (result.matchedCount) {
      res.status(200).json({ message: "Sửa danh mục thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy danh mục" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});
//thêm danh mục
router.post('/addcategory', async (req, res, next) => {
  const db = await connectDb();
  const categoryCollection = db.collection('categories');
  const { name, description } = req.body; // Giả định rằng danh mục có tên và mô tả

  const newCategory = { name, description };
  try {
    const result = await categoryCollection.insertOne(newCategory);
    // Kiểm tra xem insertedId có tồn tại không (cho thấy đã chèn thành công)
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm danh mục thành công" });
    } else {
      res.status(500).json({ message: "Thêm danh mục thất bại" }); // Xem xét sử dụng 500 cho lỗi không mong muốn
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" }); // Thông báo lỗi tổng quát cho người dùng
  }
});
// -------------------------------------------------END CATEGORIES-----------------------------------------------------------

module.exports = router;
