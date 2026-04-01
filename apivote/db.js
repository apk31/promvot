require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: true, // Verification is now enabled
    ca: process.env.DB_CA_CERT // Using the CA certificate from environment variables
  }
});

module.exports = pool;