const { getEmailQueue } = require('./emailQueue');
const { sendEmail } = require('./emailService'); // Logic gửi email

// Thêm yêu cầu trả hàng vào hàng đợi
async function enqueueReturnRequest(orderId, customerName, reason,customerEmail) {
  const emailQueue = getEmailQueue();
  await emailQueue.add('return_request', {
    orderId,
    customerName,
    reason,
    customerEmail
  });
  console.log(`Yêu cầu trả hàng đã được thêm vào hàng đợi: ${orderId}`);
}

// Xử lý công việc trong hàng đợi trả hàng
async function processReturnQueue() {
  const emailQueue = getEmailQueue();

  emailQueue.process('return_request', async (job) => {
    const { orderId, customerName, reason,customerEmail } = job.data;
    

    // Gửi email thông báo cho admin
    
    const adminEmail = 'fashionverse112@gmail.com';
    const mailOptions = {
      from:customerEmail,
      to: adminEmail,
      subject: 'Yêu cầu trả hàng từ khách hàng',
      html: `
        <h3>Khách hàng yêu cầu trả hàng</h3>
        <p>Mã đơn hàng: ${orderId}</p>
        <p>Khách hàng: ${customerName}</p>
        <p>Email khách hàng: ${customerEmail}</p>
        <p>Lý do: ${reason}</p>
      `,
    };

    try {
      await sendEmail(mailOptions);
      console.log(`Thông báo trả hàng đã gửi thành công: ${orderId}`);
    } catch (error) {
      console.error(`Lỗi khi gửi thông báo trả hàng: ${error.message}`);
      throw error;
    }
  });

  console.log("Hàng đợi trả hàng đã sẵn sàng xử lý.");
}

module.exports = { enqueueReturnRequest, processReturnQueue };
