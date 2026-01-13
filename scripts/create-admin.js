import { query } from '../src/db/index.js';
import bcrypt from 'bcrypt';

const createAdmin = async () => {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await query(`
            INSERT INTO users (first_name, last_name, email, password, role, account_type, is_verified, status)
            VALUES ('Admin', 'User', $1, $2, 'admin', 'admin', true, 'active')
            ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active'
        `, ['admin@hermexpress.com', hashedPassword]);

        console.log('Admin user created/updated: admin@hermexpress.com / admin123');
        process.exit(0);
    } catch (err) {
        console.error('Failed to create admin:', err);
        process.exit(1);
    }
};

createAdmin();
