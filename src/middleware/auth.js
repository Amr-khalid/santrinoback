import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح لك، يرجى تسجيل الدخول أولاً',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'santrino_super_secret_jwt_key_2025');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق غير صالح أو انتهت صلاحيته',
    });
  }
};
