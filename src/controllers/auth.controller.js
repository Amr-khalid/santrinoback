import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'santrino_super_secret_jwt_key_2025', {
    expiresIn: '30d',
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع الحقول المطلوبة (الاسم، الهاتف، كلمة المرور)',
      });
    }

    const cleanPhone = phone.toString().trim();
    const cleanName = name.toString().trim();

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف',
      });
    }

    const userExists = await User.findOne({ phone: cleanPhone });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مسجل مسبقاً، يمكنك تسجيل الدخول باستخدام هذا الرقم',
      });
    }

    const user = await User.create({
      name: cleanName,
      phone: cleanPhone,
      password,
      role: role || 'player',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رقم الهاتف وكلمة المرور',
      });
    }

    const cleanPhone = phone.toString().trim();

    const user = await User.findOne({ phone: cleanPhone }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'رقم الهاتف أو كلمة المرور غير صحيحة',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const { email, name, avatar, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        googleId: googleId || `google_${Date.now()}`,
        avatar: avatar || '',
        role: 'player',
      });
    } else {
      if (googleId && !user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone || '',
        email: user.email || '',
        avatar: user.avatar || '',
        role: user.role,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'رمز تفويض Google (code) مطلوب' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ضبط GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف .env للسيرفر لاستخدام Google OAuth2 الفعلي',
      });
    }

    // Exchange auth code for access token & id_token with Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || 'http://localhost:3000/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      return res.status(400).json({
        success: false,
        message: tokenData.error_description || 'فشل الحصول على بيانات الحساب من Google',
      });
    }

    // Fetch verified profile info
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`);
    const payload = await infoRes.json();

    const email = payload.email;
    const name = payload.name || payload.email.split('@')[0];
    const googleId = payload.sub;
    const avatar = payload.picture || '';

    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar,
        role: 'player',
      });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'تم التسجيل عبر Google OAuth2 بنجاح',
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone || '',
        email: user.email || '',
        avatar: user.avatar || '',
        role: user.role,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (phone) {
      const phoneClean = phone.trim();
      if (!/^01[0125][0-9]{8}$/.test(phoneClean)) {
        return res.status(400).json({ success: false, message: 'يرجى إدخال رقم هاتف مصري صحيح (11 رقم)' });
      }

      const existingPhoneUser = await User.findOne({
        phone: phoneClean,
        _id: { $ne: user._id },
      });

      if (existingPhoneUser) {
        return res.status(400).json({ success: false, message: 'رقم الهاتف هذا مستخدم بالفعل في حساب آخر' });
      }

      user.phone = phoneClean;
    }

    if (name) user.name = name.trim();

    await user.save();

    res.json({
      success: true,
      message: 'تم تحديث البيانات بنجاح',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
