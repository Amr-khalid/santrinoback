export const errorHandler = (err, req, res, next) => {
  console.error('Error Stack:', err.stack || err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'حدث خطأ في الخادم الداخلي';

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    if (err.keyPattern && err.keyPattern.phone) {
      message = 'رقم الهاتف مسجل بالفعل';
    } else if (err.keyPattern && err.keyPattern.startTime) {
      message = 'هذا الموعد محجوز مسبقاً، يرجى اختيار موعد آخر';
    } else {
      message = 'يوجد تكرار في البيانات المدخلة';
    }
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
