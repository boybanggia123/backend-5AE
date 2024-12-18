var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;

// router.post("/addproduct", upload.single("image"), async (req, res) => {
//   const db = await connectDb();
//   const productCollection = db.collection("products");
//   const {
//     name,
//     description,
//     price,
//     discountedPrice,
//     size,
//     quantity,
//     status,
//     dayadd,
//     hot,
//     categoryId,
//     color,
//   } = req.body;

//   try {
//     // Tải ảnh lên Cloudinary
//     let imageUrl = "";
//     if (req.file) {
//       imageUrl = await new Promise((resolve, reject) => {
//         const uploadStream = cloudinary.uploader.upload_stream(
//           { folder: "product_images" },
//           (error, result) => {
//             if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
//             else resolve(result.secure_url);
//           }
//         );
//         uploadStream.end(req.file.buffer);
//       });
//     }

//     const categoryObjectId = categoryId ? new ObjectId(categoryId) : null;
//     // Đối tượng sản phẩm mới
//     const newProduct = {
//       name,
//       description,
//       price,
//       discountedPrice,
//       size: size ? JSON.parse(size) : [],
//       quantity,
//       status,
//       dayadd: dayadd ? new Date(dayadd) : new Date(),
//       hot: hot === "true", // Đảm bảo đúng kiểu dữ liệu boolean
//       categoryId: categoryObjectId,
//       // reviews: reviews ? JSON.parse(reviews) : [],
//       color: Array.isArray(color) ? color : JSON.parse(color || "[]"), // Thêm màu sắc vào
//       image: imageUrl, // URL ảnh từ Cloudinary
//       createdAt: new Date(), // Thời gian thêm
//       updatedAt: new Date(), 
//     };

//     const result = await productCollection.insertOne(newProduct);
//     if (result.insertedId) {
//       res
//         .status(200)
//         .json({ message: "Thêm sản phẩm thành công", product: newProduct });
//     } else {
//       res.status(500).json({ message: "Thêm sản phẩm thất bại" });
//     }
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
//   }
// });

// // sửa sản phẩm
// router.put("/updateproduct/:id", upload.single("image"), async (req, res) => {
//   const db = await connectDb();
//   const productCollection = db.collection("products");
//   const id = new ObjectId(req.params.id);
//   const updates = req.body;

//   try {
//     // Tải ảnh mới lên Cloudinary nếu có
//     if (req.file) {
//       updates.image = await new Promise((resolve, reject) => {
//         const uploadStream = cloudinary.uploader.upload_stream(
//           { folder: "product_images" },
//           (error, result) => {
//             if (error) reject(new Error("Tải ảnh lên Cloudinary thất bại"));
//             else resolve(result.secure_url);
//           }
//         );
//         uploadStream.end(req.file.buffer);
//       });
//     }

//     // Chuyển đổi các trường về đúng kiểu dữ liệu
//     updates.price = updates.price ? Number(updates.price) : undefined;
//     updates.discountedPrice = updates.discountedPrice
//       ? Number(updates.discountedPrice)
//       : undefined;
//     updates.size = updates.size ? JSON.parse(updates.size) : undefined;
//     updates.quantity = updates.quantity ? Number(updates.quantity) : undefined;
//     updates.hot = updates.hot === "true";
//     updates.dayadd = updates.dayadd ? new Date(updates.dayadd) : undefined;
//     updates.reviews = updates.reviews ? JSON.parse(updates.reviews) : undefined;
//     updates.color = updates.color ? JSON.parse(updates.color) : undefined; 
//     if (updates.categoryId) {
//       updates.categoryId = new ObjectId(updates.categoryId);
//     }
//     updates.updatedAt = new Date();
//     const result = await productCollection.updateOne(
//       { _id: id },
//       { $set: updates }
      
//     );
    

//     if (result.modifiedCount > 0) {
//       res.status(200).json({ message: "Cập nhật sản phẩm thành công" });
//     } else {
//       res.status(404).json({ message: "Không tìm thấy sản phẩm" });
//     }
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
//   }
// });
