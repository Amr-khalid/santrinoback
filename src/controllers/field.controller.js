import Field from '../models/Field.js';

/**
 * Get primary field (or first active field)
 */
export const getPrimaryField = async (req, res, next) => {
  try {
    let field = await Field.findOne({ isActive: true }).populate('owner', 'name phone');
    if (!field) {
      field = await Field.findOne().populate('owner', 'name phone');
    }

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد ملعب مسجل حالياً',
      });
    }

    res.json({
      success: true,
      data: field,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get field by ID
 */
export const getFieldById = async (req, res, next) => {
  try {
    const field = await Field.findById(req.params.id).populate('owner', 'name phone');
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'الملعب غير موجود',
      });
    }
    res.json({
      success: true,
      data: field,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update field details (Owner only)
 */
export const updateField = async (req, res, next) => {
  try {
    const field = await Field.findById(req.params.id);
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'الملعب غير موجود',
      });
    }

    // Ensure owner or admin
    if (field.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذا الملعب',
      });
    }

    const updatedField = await Field.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: updatedField,
    });
  } catch (error) {
    next(error);
  }
};
