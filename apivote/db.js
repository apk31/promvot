require('dotenv').config();
const { Pool } = require('pg');

// THIS IS THE TRUTH TELLER:
// console.log("--> My DB URL is:", process.env.DB_URL);

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;