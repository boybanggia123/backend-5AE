// const nodemailer = require('nodemailer');
// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const path = require('path');

// // Hàm tạo file PDF hóa đơn
// async function createBillPDF(data) {
//   const invoiceDir = path.join(__dirname, 'invoices');
//   if (!fs.existsSync(invoiceDir)) {
//     fs.mkdirSync(invoiceDir, { recursive: true }); // Tạo thư mục nếu chưa tồn tại
//   }

//   const doc = new PDFDocument();
//   const filePath = path.join(invoiceDir, `invoice-${data.orderId}.pdf`);

//   doc.pipe(fs.createWriteStream(filePath));

//   doc.text('Hóa đơn thanh toán', { align: 'center' });
//   doc.text(`Mã đơn hàng: ${data.orderId}`);
//   doc.text(`Số tiền thanh toán: ${data.amount} USD`);
//   doc.end();

//   return filePath;
// }

// // Hàm gửi email
// async function sendEmail(userEmail, billDetails, pdfPath) {
//   const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//       user: 'fashionverse112@gmail.com',
//       pass: 'xczyubpahutsqivm', // Mật khẩu ứng dụng Gmail
//     },
//   });

//   const mailOptions = {
//     from: 'fashionverse112@gmail.com',
//     to: userEmail,
//     subject: 'Hóa đơn thanh toán',
//     text: `Xin chào, đơn hàng của bạn đã được thanh toán thành công. Hóa đơn của bạn đã được đính kèm.`,
//     attachments: [
//       {
//         filename: `invoice-${billDetails.orderId}.pdf`,
//         path: pdfPath,
//       },
//     ],
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`Email sent successfully to ${userEmail}`);
//   } catch (error) {
//     console.error(`Failed to send email to ${userEmail}:`, error.message);
//     throw error;
//   }
// }

// // Test: Tích hợp tạo PDF và gửi email
// (async () => {
//   const billDetails = {
//     orderId: '12345',
//     amount: 150.0,
//     userEmail: 'huytdps29107@fpt.edu.vn', // Thay bằng email người nhận
//   };

//   try {
//     console.log('Creating PDF...');
//     const pdfPath = await createBillPDF(billDetails);

//     console.log('Sending email...');
//     await sendEmail(billDetails.userEmail, billDetails, pdfPath);

//     console.log('Test completed successfully.');
//   } catch (error) {
//     console.error('Test failed:', error.message);
//   }
// })();
