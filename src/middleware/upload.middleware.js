import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Cloudinary v2 will automatically read CLOUDINARY_URL from process.env
// No explicit config needed if CLOUDINARY_URL is set.
// However, calling config() with no args ensures it checks env.
cloudinary.config(); 

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
        if (file.fieldname === 'avatar') return 'hermexpress/avatars';
        if (file.fieldname === 'image') return 'hermexpress/payments';
        return 'hermexpress/user_ids';
    },
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    public_id: (req, file) => {
        const userId = req.user ? req.user.id : 'anon';
        const timestamp = Date.now();
        return `${file.fieldname}-${userId}-${timestamp}`;
    }
  },
});

export const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
