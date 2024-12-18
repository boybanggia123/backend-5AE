var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
var http = require("http");

var app = express();


var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var stripeRouter = require("./routes/stripe");
var uploadRouter = require("./routes/uploads");


app.use(cors());

// view engine setup
app.use(cors());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));



app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/stripe",  stripeRouter);
app.use("/uploads", uploadRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message; 
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

const { initializeRedis } = require('./services/emailQueue');
const { processEmailQueue } = require('./services/emailService');


// Hàm khởi tạo toàn bộ ứng dụng
(async () => {
  try {
    // Khởi tạo Redis
    await initializeRedis();
    console.log("Redis đã khởi chạy thành công, ứng dụng đã sẵn sàng...");
    // Khởi chạy xử lý hàng đợi email sau khi Redis đã sẵn sàng
    await processEmailQueue();
    console.log("Hàng đợi email đã được xử lý.");
  } catch (error) {
    console.error("Không thể khởi tạo Redis hoặc xử lý hàng đợi email:", error.message);
    process.exit(1); // Dừng ứng dụng nếu lỗi nghiêm trọng xảy ra
  }
})();




module.exports = app;
