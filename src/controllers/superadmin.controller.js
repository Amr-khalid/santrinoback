import User from '../models/User.js';
import Field from '../models/Field.js';
import Booking from '../models/Booking.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


/**
 * @desc    Get global platform stats for superadmin
 * @route   GET /api/superadmin/stats
 * @access  Private (SuperAdmin only)
 */
export const getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      superAdminsCount,
      adminsCount,
      ownersCount,
      playersCount,
      fieldsCount,
      bookingsCount,
      confirmedBookings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'superadmin' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'player' }),
      Field.countDocuments(),
      Booking.countDocuments(),
      Booking.find({ status: 'confirmed' }).select('totalPrice'),
    ]);

    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    res.json({
      success: true,
      stats: {
        totalUsers,
        superAdminsCount,
        adminsCount,
        ownersCount,
        playersCount,
        fieldsCount,
        bookingsCount,
        confirmedBookingsCount: confirmedBookings.length,
        totalRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of users with search and role filter
 * @route   GET /api/superadmin/users
 * @access  Private (SuperAdmin only)
 */
export const getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;

    const query = {};

    if (role && ['player', 'owner', 'admin', 'superadmin'].includes(role)) {
      query.role = role;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      count: users.length,
      total,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new admin, owner or user
 * @route   POST /api/superadmin/users
 * @access  Private (SuperAdmin only)
 */
export const createAdmin = async (req, res, next) => {
  try {
    const { name, phone, email, password, role = 'admin' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم مطلوب',
      });
    }

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف أو البريد الإلكتروني مطلوب',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف',
      });
    }

    if (!['admin', 'owner', 'superadmin', 'player'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'نوع الدور غير صالح',
      });
    }

    // Check existing phone
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone.trim() });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'رقم الهاتف مسجل مسبقاً لمستخدم آخر',
        });
      }
    }

    // Check existing email
    if (email) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مسجل مسبقاً',
        });
      }
    }

    const newUser = await User.create({
      name: name.trim(),
      phone: phone ? phone.trim() : undefined,
      email: email ? email.trim().toLowerCase() : undefined,
      password,
      role,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: `تم إنشاء حساب ${role === 'admin' ? 'المسؤول' : role === 'owner' ? 'المالك' : role} بنجاح`,
      user: userObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a user role
 * @route   PUT /api/superadmin/users/:id/role
 * @access  Private (SuperAdmin only)
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'owner', 'superadmin', 'player'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'نوع الدور غير صالح',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    // If changing the current user's own role from superadmin, check if other superadmins exist
    if (user._id.toString() === req.user._id.toString() && role !== 'superadmin') {
      const superAdminsCount = await User.countDocuments({ role: 'superadmin' });
      if (superAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تقليص صلاحياتك كمدير عام وحيد في النظام',
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `تم تغيير دور ${user.name} إلى ${role === 'superadmin' ? 'مدير عام' : role === 'admin' ? 'مسؤول' : role === 'owner' ? 'مالك ملعب' : 'لاعب'} بنجاح`,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password for a user by superadmin
 * @route   PUT /api/superadmin/users/:id/password
 * @access  Private (SuperAdmin only)
 */
export const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف',
      });
    }

    const user = await User.findById(id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: `تمت إعادة تعيين كلمة المرور للمستخدم (${user.name}) بنجاح`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/superadmin/users/:id
 * @access  Private (SuperAdmin only)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك حذف حسابك الشخصي أثناء تسجيل الدخول',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    if (user.role === 'superadmin') {
      const superAdminsCount = await User.countDocuments({ role: 'superadmin' });
      if (superAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن حذف المدير العام الوحيد في النظام',
        });
      }
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `تم حذف حساب المستخدم (${user.name}) بنجاح`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Impersonate / login as any user
 * @route   POST /api/superadmin/impersonate/:id
 * @access  Private (SuperAdmin only)
 */
export const impersonateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم المطلوب غير موجود',
      });
    }

    const token = jwt.sign(
      { id: targetUser._id },
      process.env.JWT_SECRET || 'santrino_super_secret_jwt_key_2025',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: `تم تسجيل الدخول بحساب (${targetUser.name}) بنجاح`,
      data: {
        _id: targetUser._id,
        name: targetUser.name,
        phone: targetUser.phone,
        email: targetUser.email,
        role: targetUser.role,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

