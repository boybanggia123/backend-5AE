const express = require("express");
const multer = require("multer");
var router = express.Router();
const cors = require("cors");
const app = express();

const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();
const connectDb = require("../model/db");
const { ObjectId } = require("mongodb");
app.use(express.json()); // Phân tích JSON
app.use(express.urlencoded({ extended: true })); // Phân tích URL-encoded
app.use(cors());

cloudinary.config({
  cloud_name: "dwrp82bhy",
  api_key: "667485257866548",
  api_secret: "DkqnpV-tBbyoAOxWz4ORdfLIhi8",
});

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
// danh mục sản phẩm

// Thêm sản phẩm và tải lên Cloudinary
// Nếu bạn muốn upload nhiều ảnh, sử dụng upload.array cho tất cả các ảnh
const { Int32 } = require('mongodb');  // Đảm bảo sử dụng Int32 từ MongoDB

router.post("/addproduct", upload.fields([{ name: 'images', maxCount: 1 }, { name: 'additionalImages', maxCount: 5 }]), async (req, res) => {
  const db = await connectDb();
  const productCollection = db.collection("products");
  const {
    name,
    description,
    price = 0,  // Gán mặc định là 0 nếu không có giá
    discountedPrice,  // Không gán giá trị mặc định tại đây
    size,
    quantity,
    status,
    hot,
    categoryId,
    color,
  } = req.body;

  try {
    // Kiểm tra và xử lý discountedPrice để tránh NaN và gán giá trị mặc định là 0 nếu không có giá trị
    let finalDiscountedPrice = discountedPrice;
    if (typeof finalDiscountedPrice === 'undefined' || isNaN(finalDiscountedPrice) || finalDiscountedPrice < 0) {
      finalDiscountedPrice = 0; // Nếu giá giảm không hợp lệ hoặc không có giá trị, gán mặc định là 0
    }

    // Kiểm tra kiểu dữ liệu các trường
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: "Tên sản phẩm là bắt buộc và phải là chuỗi" });
    }
    if (typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ message: "Mô tả sản phẩm là bắt buộc và phải là chuỗi" });
    }
    if (price < 0) {
      return res.status(400).json({ message: "Giá sản phẩm phải là một số dương hoặc bằng 0" });
    }
    if (finalDiscountedPrice < 0) {
      return res.status(400).json({ message: "Giá giảm phải là một số dương hoặc bằng 0" });
    }
    if (typeof size !== 'string') {
      return res.status(400).json({ message: "Kích cỡ sản phẩm phải là một chuỗi" });
    }
    if (quantity < 0) {
      return res.status(400).json({ message: "Số lượng phải là một số dương hoặc bằng 0" });
    }
    if (typeof status !== 'string') {
      return res.status(400).json({ message: "Trạng thái sản phẩm phải là chuỗi" });
    }
    if (hot !== "true" && hot !== "false") {
      return res.status(400).json({ message: "Giá trị 'hot' phải là 'true' hoặc 'false'" });
    }
    if (categoryId && !ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "ID danh mục không hợp lệ" });
    }
    if (color && !Array.isArray(color) && typeof color !== 'string') {
      return res.status(400).json({ message: "Màu sắc phải là mảng hoặc chuỗi hợp lệ" });
    }

    // Kiểm tra và xử lý các ảnh
    let mainImageUrl = "";
    let additionalImages = [];

    if (req.files) {
      // Kiểm tra và tải ảnh chính lên Cloudinary
      if (req.files['images'] && req.files['images'].length > 0) {
        const mainImage = req.files['images'][0]; // Ảnh chính
        mainImageUrl = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "product_image" },
            (error, result) => {
              if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
              else resolve(result.secure_url);
            }
          );
          uploadStream.end(mainImage.buffer);
        });
      }

      // Kiểm tra và tải ảnh phụ lên Cloudinary
      if (req.files['additionalImages'] && req.files['additionalImages'].length > 0) {
        additionalImages = await Promise.all(
          req.files['additionalImages'].map((file) =>
            new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "product_images" },
                (error, result) => {
                  if (error) reject(new Error("Tải ảnh phụ lên Cloudinary thất bại"));
                  else resolve(result.secure_url); // Lấy URL ảnh
                }
              );
              uploadStream.end(file.buffer);
            })
          )
        );
      }
    }

    const categoryObjectId = categoryId ? new ObjectId(categoryId) : null;

    // Đối tượng sản phẩm mới
    const newProduct = {
      name,
      description,
      price: parseFloat(price),  // Đảm bảo giá là số
      discountedPrice: new Int32(finalDiscountedPrice),  // Chuyển giá giảm thành kiểu Int32
      size: size ? JSON.parse(size) : [],
      quantity: parseInt(quantity),
      status,
      hot: hot === "true", // Đảm bảo đúng kiểu dữ liệu boolean
      categoryId: categoryObjectId,
      color: Array.isArray(color) ? color : JSON.parse(color || "[]"),
      image: mainImageUrl,  // URL ảnh chính từ Cloudinary
      additionalImages: additionalImages, // Mảng ảnh phụ
      createdAt: new Date(), // Thời gian thêm
      updatedAt: new Date(),
    };

    const result = await productCollection.insertOne(newProduct);
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm sản phẩm thành công", product: newProduct });
    } else {
      res.status(500).json({ message: "Thêm sản phẩm thất bại" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});





// sửa sản phẩm
router.put("/updateproduct/:id", upload.fields([{ name: 'images', maxCount: 1 }, { name: 'additionalImages', maxCount: 5 }]), async (req, res) => {
  console.log("Request Params:", req.params);
  console.log("Request Body:", req.body);
  console.log("Request Files:", req.files);
  const db = await connectDb();
  const productCollection = db.collection("products");
  const id = new ObjectId(req.params.id);
  const updates = req.body;

  try {
    // Kiểm tra và chuyển đổi kiểu dữ liệu cho các trường cần thiết
    updates.price = updates.price ? Number(updates.price) : undefined;
    updates.discountedPrice = updates.discountedPrice ? Number(updates.discountedPrice) : undefined;
    updates.size = updates.size ? JSON.parse(updates.size) : undefined;
    updates.quantity = updates.quantity ? Number(updates.quantity) : undefined;
    updates.hot = updates.hot === "true"; // Đảm bảo kiểu boolean
    updates.color = updates.color ? JSON.parse(updates.color) : undefined;

    // Nếu có categoryId, chuyển thành ObjectId
    if (updates.categoryId) {
      updates.categoryId = new ObjectId(updates.categoryId);
    }

    // Tải ảnh chính lên Cloudinary nếu có
    if (req.files && req.files.images) {
      updates.image = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "product_images" },
          (error, result) => {
            if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
            else resolve(result.secure_url);
          }
        );
        uploadStream.end(req.files.images[0].buffer);
      });
    }

    // Tải ảnh phụ lên Cloudinary nếu có
    let additionalImages = [];
    if (req.files && req.files.additionalImages) {
      additionalImages = await Promise.all(
        req.files.additionalImages.map((file) =>
          new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "product_images" },
              (error, result) => {
                if (error) reject(new Error("Tải ảnh phụ lên Cloudinary thất bại"));
                else resolve(result.secure_url); // Lấy URL ảnh
              }
            );
            uploadStream.end(file.buffer);
          })
        )
      );
    }

    // Gộp ảnh phụ từ client và ảnh mới tải lên
    const clientAdditionalImages = updates.additionalImages
      ? Array.isArray(updates.additionalImages)
        ? updates.additionalImages
        : [updates.additionalImages]
      : [];

    const mergedAdditionalImages = [
      ...clientAdditionalImages, // Ảnh từ client (cũ và mới)
      ...additionalImages, // Ảnh vừa tải lên
    ];

    // Cập nhật thông tin sản phẩm
    updates.additionalImages = mergedAdditionalImages;
    updates.updatedAt = new Date();

    const result = await productCollection.updateOne(
      { _id: id },
      { $set: updates } // Ghi đè tất cả thông tin sản phẩm
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Cập nhật sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});






// xóa sản phẩm
router.delete("/deleteproduct/:id", async (req, res) => {
  const db = await connectDb();
  const productCollection = db.collection("products");
  const id = new ObjectId(req.params.id);

  try {
    const product = await productCollection.findOne({ _id: id });
    if (product && product.image) {
      // Xóa ảnh từ Cloudinary
      const publicId = product.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`product_images/${publicId}`);
    }

    const result = await productCollection.deleteOne({ _id: id });
    if (result.deletedCount > 0) {
      res.status(200).json({ message: "Xóa sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

module.exports = router;
