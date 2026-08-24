export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح لك، يرجى تسجيل الدخول',
      });
    }

    // SuperAdmin always has full access to admin and owner resources
    if (req.user.role === 'superadmin' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `دور المستخدم (${req.user.role}) غير مصرح له بتنفيذ هذا الإجراء`,
    });
  };
};

