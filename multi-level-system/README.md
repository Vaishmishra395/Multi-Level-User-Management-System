# Multi-Level System

A comprehensive multi-level user management system with balance transfer, commission system, and admin features.

## Features

### ✅ Authentication
- User registration and login with CAPTCHA verification
- JWT-based authentication stored in HTTP-only cookies
- Session-based CAPTCHA (expires in 5 minutes)
- Secure logout functionality
- Protected routes for authenticated users only

### ✅ User Hierarchy & Permissions
- **N-level user hierarchy** - Supports unlimited levels
- Users can create only their **next-level users** (direct children)
- Users can view only their **own downline** (all users created directly or indirectly)
- Users can change password of their **next-level users only**
- Hierarchical tree view of downline

### ✅ Balance Management
- **Owner self-recharge** - Owners can recharge their own balance
- **Transfer to next-level only** - Users can credit balance to their direct children only
- **Automatic deduction** - Amount credited is deducted from sender's balance
- **Detailed statements** with:
  - Credit and debit transactions
  - Sender/receiver details
  - Timestamps
  - Transaction descriptions

### ✅ Admin Features
- View all **next-level users** (top-level users)
- Click any user to view their **complete downline hierarchy**
- **Credit balance to any user** in the hierarchy:
  - Amount deducted from user's immediate parent automatically
  - Direct credit for owners (no parent)
- **Balance summary** with:
  - Total users and balance
  - Balance breakdown by level
  - Complete user listing

### ✅ Bonus Features
- **Commission System**:
  - Automatic commission on transfers (configurable percentage, default 2%)
  - Commission credited to sender's parent
  - Commission tracking and viewing
- **Responsive UI** with modern design
- **Session-based CAPTCHA** (5-minute expiration)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-level-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup database**
   - Create a MySQL database
   - Update `.env` file with database credentials
   - Run the schema file:
     ```bash
     mysql -u root -p < database/schema.sql
     ```

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Update with your database credentials and JWT secret:
     ```env
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_password
     DB_NAME=multi_level_system
     JWT_SECRET=your_secret_key_here
     PORT=3000
     COMMISSION_PERCENTAGE=2
     SESSION_SECRET=your_session_secret
     ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   - Open browser: `http://localhost:3000`
   - Register a new account or login with admin credentials

## Default Admin Account

- **Username:** `admin`
- **Password:** `admin123`

**⚠️ Important:** Change the admin password after first login!

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password` - Hashed password (bcrypt)
- `balance` - User balance
- `parent_id` - Reference to parent user (NULL for owners)
- `role` - User role (user/admin)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Transactions Table
- `id` - Primary key
- `sender_id` - User who sent the money
- `receiver_id` - User who received the money
- `amount` - Transaction amount
- `type` - CREDIT or DEBIT
- `description` - Transaction description
- `commission` - Commission amount (if applicable)
- `created_at` - Transaction timestamp

### Commissions Table
- `id` - Primary key
- `user_id` - User who earned commission
- `transaction_id` - Related transaction
- `amount` - Commission amount
- `percentage` - Commission percentage
- `created_at` - Commission timestamp

## API Routes

### Authentication Routes
- `GET /login` - Login page
- `POST /login` - Login user
- `GET /register` - Registration page
- `POST /register` - Register new user
- `GET /logout` - Logout user

### User Routes (Protected)
- `GET /dashboard` - User dashboard
- `GET /create-user` - Create user page
- `POST /create-user` - Create next-level user
- `GET /downline` - View downline hierarchy
- `GET /change-password` - Change password page
- `POST /change-password` - Change password for next-level user
- `GET /self-recharge` - Self recharge page (owners only)
- `POST /self-recharge` - Self recharge balance (owners only)
- `GET /commission` - View commission earnings
- `GET /transfer` - Transfer money page
- `POST /transfer` - Transfer money to next-level user
- `GET /statement` - View transaction statement

### Admin Routes (Protected, Admin only)
- `GET /admin` - Admin panel
- `GET /admin/user/:userId/downline` - View user's downline
- `GET /admin/user/:userId/credit` - Credit balance page
- `POST /admin/user/:userId/credit` - Credit balance to user
- `GET /admin/summary` - Balance summary

## Features in Detail

### User Hierarchy
- Each user can only create users at their immediate next level
- Users can view their complete downline (all levels below them)
- Hierarchical tree structure maintained in database

### Balance Transfers
- Transfers only allowed to direct children (next-level users)
- Automatic balance deduction from sender
- Commission automatically calculated and credited to sender's parent
- Transaction records maintained for both sender and receiver

### Commission System
- Configurable commission percentage (default 2%)
- Commission calculated on each transfer
- Commission credited to sender's parent
- Commission tracking and viewing available

### Admin Features
- View all top-level users
- Navigate through complete user hierarchy
- Credit balance to any user (deducted from parent)
- View comprehensive balance summary

## Security Features

- Password hashing with bcrypt
- JWT tokens in HTTP-only cookies
- CAPTCHA verification on login/registration
- Session-based CAPTCHA (5-minute expiration)
- SQL injection prevention with parameterized queries
- Input validation and sanitization
- Role-based access control

## Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JWT, bcrypt
- **View Engine:** EJS
- **Session:** express-session

## Development

```bash
# Install dependencies
npm install

# Start development server (with nodemon)
npm start

# The server will run on http://localhost:3000
```

## Environment Variables

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=multi_level_system
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=development
COMMISSION_PERCENTAGE=2
SESSION_SECRET=your_session_secret
```

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
