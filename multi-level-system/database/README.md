# Database Setup

## Installation

1. Make sure MySQL is installed and running
2. Update your `.env` file with database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=multi_level_system
   ```

## Setup Steps

1. Run the schema file to create the database and tables:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. Or manually execute the SQL commands in `schema.sql`

## Default Admin Account

- Username: `admin`
- Password: `admin123`

**Important:** Change the admin password after first login!

## Database Structure

### Users Table
- `id`: Primary key
- `username`: Unique username
- `password`: Hashed password (bcrypt)
- `balance`: User balance
- `parent_id`: Reference to parent user (NULL for owners)
- `role`: User role (user/admin)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Transactions Table
- `id`: Primary key
- `sender_id`: User who sent the money
- `receiver_id`: User who received the money
- `amount`: Transaction amount
- `type`: CREDIT or DEBIT
- `description`: Transaction description
- `commission`: Commission amount (if applicable)
- `created_at`: Transaction timestamp

### Commissions Table
- `id`: Primary key
- `user_id`: User who earned commission
- `transaction_id`: Related transaction
- `amount`: Commission amount
- `percentage`: Commission percentage
- `created_at`: Commission timestamp
