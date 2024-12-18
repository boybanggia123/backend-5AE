const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');  // Thêm thư viện sharp

async function createBillPDF(data) {
  // Tạo thư mục lưu hóa đơn nếu chưa tồn tại
  const invoiceDir = path.join(__dirname, 'invoices');
  if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
  }

  // Khởi tạo tài liệu PDF
  const doc = new PDFDocument({ margin: 50 });

  // Đường dẫn tới phông chữ tùy chỉnh
  const fontPath = path.join(__dirname, '../fonts/DejaVuSans.ttf');
  if (fs.existsSync(fontPath)) {
    doc.font(fontPath); // Sử dụng phông chữ tùy chỉnh nếu có
  } else {
    doc.font('Helvetica'); // Sử dụng phông chữ mặc định nếu không tìm thấy
  }

  // Đường dẫn lưu file PDF
  const filePath = path.join(invoiceDir, `invoice-${data.payment_intent}.pdf`);
  doc.pipe(fs.createWriteStream(filePath));

  // Header: Tiêu đề hóa đơn
  doc
    .fontSize(20)
    .text('HÓA ĐƠN THANH TOÁN', { align: 'center', underline: true })
    .moveDown();

  // Thông tin khách hàng và hóa đơn
  const shipping = data.customer_details || {};
  const address = shipping.address || {};
  doc
    .fontSize(12)
    .text(`Mã đơn hàng: ${data.payment_intent || 'N/A'}`)
    .text(`Tên khách hàng: ${shipping.name || 'N/A'}`)
    .text(`Email: ${shipping.email || 'N/A'}`)
    .text(`Địa chỉ giao hàng: ${address.line1 || 'N/A'}, ${address.city || 'N/A'}`)
    .text(`Số tiền thanh toán: ${(data.amount_total).toLocaleString('vi-VN') || "N/A"} đ`)
    .text(`Ngày thanh toán: ${new Date().toLocaleDateString('vi-VN')}`)
    .moveDown();

      // Thông tin giảm giá (nếu có)
      const coupon = data.coupon || 'N/A';
      const discount = data.discount || 0;
      doc
        .fontSize(12)
        .text(`Mã giảm giá: ${coupon}`, { align: 'left' })
        .text(`Giảm giá: ${discount}%`, { align: 'left' })
        .moveDown();


  // Chi tiết sản phẩm với hình ảnh và size
  const products = data.products || [];
  doc.fontSize(14).text('Chi tiết sản phẩm:', { underline: true }).moveDown();

  for (let index = 0; index < products.length; index++) {
    const product = products[index];

    // Nếu sản phẩm có hình ảnh từ URL
    if (product.image && product.image.startsWith('http')) {
      try {
        // Tải hình ảnh từ URL bằng axios
        const imageBuffer = await axios.get(product.image, { responseType: 'arraybuffer' });

        // Chuyển đổi hình ảnh WebP sang PNG (PDFKit hỗ trợ PNG)
        const imageBufferPNG = await sharp(imageBuffer.data)
          .png() // Chuyển đổi thành định dạng PNG
          .toBuffer();

        // Chèn ảnh vào PDF từ bộ nhớ đệm
        doc.image(imageBufferPNG, { width: 100, height: 100, align: 'left' });
      } catch (error) {
        console.error('Lỗi khi chèn hình ảnh:', error.message); // Log lỗi
        doc.fontSize(12).text(`[Hình ảnh không khả dụng]`, { align: 'left' });
      }
    }

    // Ghi thông tin sản phẩm bên dưới hình ảnh
    doc
      .fontSize(12)
      .text(
        `${index + 1}. ${product.name || 'N/A'} - Size: ${
          product.size || 'N/A'
        } - Số lượng: ${product.quantity || 'N/A'} - Giá: ${(product.price ).toLocaleString('vi-VN')} đ 
        - Giảm giá:${(product.discountedPrice || "0" )} % `
      )
      .moveDown();
  }

  // Tổng cộng
  doc
    .moveDown()
    .fontSize(14)
    .text(`Tổng cộng: ${(data.amount_total).toLocaleString('vi-VN')} đ`, { align: 'right' });

  // Footer: Lời cảm ơn
  doc
    .moveDown()
    .fontSize(10)
    .text('Cảm ơn bạn đã mua hàng tại FashionVerse!', { align: 'center' });

  // Kết thúc tài liệu PDF
  doc.end();

  return filePath;
}

module.exports = { createBillPDF };
