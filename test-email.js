// const { initializeRedis, getEmailQueue } = require('./services/emailQueue');
// require('dotenv').config();

// (async () => {
//   try {
//     // Khởi tạo Redis và queue email
//     await initializeRedis();

//     // Lấy queue email
//     const emailQueue = getEmailQueue();

//     // Thêm một job mới vào queue
//     await emailQueue.add({
//       to: 'test@example.com',
//       subject: 'Test Email',
//       body: 'Đây là nội dung test của email queue.',
//     });

//     console.log('Job gửi email đã được thêm vào queue thành công.');

//     // Lắng nghe job
//     emailQueue.process(async (job) => {
//       console.log('Đang xử lý job:', job.id);
//       console.log('Nội dung job:', job.data);
//       // Giả lập gửi email
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       console.log('Gửi email thành công!');
//     });

//     // Xử lý sự kiện thành công
//     emailQueue.on('completed', (job) => {
//       console.log(`Job ${job.id} đã hoàn thành.`);
//     });

//     // Xử lý sự kiện lỗi
//     emailQueue.on('failed', (job, err) => {
//       console.error(`Job ${job.id} thất bại:`, err.message);
//     });
//   } catch (error) {
//     console.error('Lỗi trong quá trình test email queue:', error.message);
//   }
// })();
