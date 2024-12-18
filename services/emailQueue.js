// emailQueue.js

const { createClient } = require('redis');
const Queue = require('bull');

const client = createClient({
  url: 'redis://127.0.0.1:6379',
});

let emailQueue;
let redisInitialized = false;
let isInitializing = false;

async function connectWithRetry(retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      console.log('Kết nối Redis thành công.');
      return;
    } catch (error) {
      console.error(`Thử kết nối Redis lần ${i + 1} thất bại:`, error.message);
      if (i < retries - 1) {
        console.log(`Đang chờ ${delay}ms trước khi thử lại...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error('Không thể kết nối Redis sau nhiều lần thử.');
      }
    }
  }
}

async function initializeRedis() {
  if (redisInitialized || isInitializing) {
    return;
  }

  isInitializing = true;

  try {
    await connectWithRetry();
    console.log("Đã kết nối Redis thành công.");

    // Khởi tạo queue email
    emailQueue = new Queue('email notifications', {
      redis: {
        host: '127.0.0.1',
        port: 6379,
      },
    });

    redisInitialized = true;
    console.log("Redis và hàng đợi email đã được khởi tạo thành công.");
  } catch (error) {
    console.error('Không thể khởi tạo Redis hoặc hàng đợi email:', error.message);
    throw error;
  } finally {
    isInitializing = false;
  }
}

function getEmailQueue() {
  if (!redisInitialized || !emailQueue) {
    throw new Error("Redis or email queue is not initialized yet");
  }
  return emailQueue;
}

module.exports = { initializeRedis, getEmailQueue };
