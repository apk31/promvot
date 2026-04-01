require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const helmet = require('helmet'); // <-- 1. Import Helmet
const rateLimit = require('express-rate-limit'); // <-- 2. Import Rate Limiter

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
// 1. Helmet hides the "X-Powered-By: Express" header and secures connections
app.use(helmet());

// 2. Strict CORS: Only allow your official frontend domain to make requests
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://vote.penguinwalk.my.id' 
    : 'http://localhost:5174', // Keeps local dev working
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// 3. The Anti-Brute Force Bouncer
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes memory
  max: 5, // Limit each IP to 5 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ==========================================
// 1. VERIFY MAGIC LINK
// ==========================================
app.get('/verify-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query('SELECT id, student_id, is_active FROM users WHERE magic_token = $1', [token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid magic link.' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This link has already been used to vote.' });
    }

    res.json({ student_id: user.student_id });
  } catch (err) {
    res.status(500).json({ error: 'Server error during verification.' });
  }
});

// ==========================================
// 2. GET ALL CATEGORIES & NOMINEES
// ==========================================
app.get('/categories', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id as category_id, 
        c.name as category_name,
        json_agg(
          json_build_object('id', n.id, 'name', n.name, 'photo_url', n.photo_url) 
          ORDER BY n.id ASC -- <-- THIS FIXES THE SHUFFLING BUG!
        ) as nominees
      FROM categories c
      JOIN nominees n ON c.id = n.category_id
      GROUP BY c.id, c.name
      ORDER BY c.id;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// ==========================================
// 3. SUBMIT VOTE (The Ironclad Transaction)
// ==========================================
app.post('/vote', async (req, res) => {
  const { token, votes } = req.body; 
  // votes expects an array: [{ category_id: 1, nominee_id: 3 }, ...]

  const client = await pool.connect(); // Grab a dedicated client for the transaction

  try {
    await client.query('BEGIN'); // START TRANSACTION

    // 1. Double check token and get user ID
    const userRes = await client.query('SELECT id, is_active FROM users WHERE magic_token = $1 FOR UPDATE', [token]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      throw new Error('Invalid or expired token.');
    }
    const userId = userRes.rows[0].id;

    // 2. Create the Ballot
    const ballotRes = await client.query(
      'INSERT INTO ballots (user_id) VALUES ($1) RETURNING id', 
      [userId]
    );
    const ballotId = ballotRes.rows[0].id;

    // 3. Insert all 9 votes
    for (const vote of votes) {
      await client.query(
        'INSERT INTO ballot_votes (ballot_id, category_id, nominee_id) VALUES ($1, $2, $3)',
        [ballotId, vote.category_id, vote.nominee_id]
      );
    }

    // 4. Burn the magic link so it can't be used again
    await client.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

    await client.query('COMMIT'); // SAVE EVERYTHING
    res.json({ success: true, message: 'Vote successfully cast!' });

  } catch (err) {
    await client.query('ROLLBACK'); // IF ANYTHING FAILS, UNDO EVERYTHING
    
    // Check if it was our unique constraint catching a double vote
    if (err.code === '23505') { 
        return res.status(400).json({ error: 'You have already voted.' });
    }
    res.status(400).json({ error: err.message });
  } finally {
    client.release(); // Return client to the pool
  }
});

// ==========================================
// 4. DEV ROUTE: GENERATE TEST USER
// ==========================================
// (Remove this before real voting starts!)
app.post('/dev/generate-user', async (req, res) => {
  try {
    for (let i = 0; i < 10; i++) {
      const studentId = `TEST-${i.toString().padStart(2, '0')}`;
      const magicToken = `test-token-${i.toString().padStart(2, '0')}`;

    
    await pool.query(
      'INSERT INTO users (student_id, magic_token) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING',
      [studentId, magicToken]
    );
    res.json({ message: `Test user created! Magic link will be: /vote/${magicToken}` });
  }
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ADMIN LOGIN ROUTE (Now Protected)
// ==========================================
// Pass the `loginLimiter` middleware right before the route logic
app.post('/admin/login', loginLimiter, (req, res) => {
  try {
    const { password } = req.body;
    
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL ERROR: JWT_SECRET is missing!");
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    if (password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Incorrect password.' });
    }
  } catch (err) {
    console.error("Login Crash:", err);
    res.status(500).json({ error: 'Failed to generate token.' });
  }
});

// ==========================================
// 6. THE BOUNCER (Authentication Middleware)
// ==========================================
const verifyAdmin = (req, res, next) => {
  // Check if the frontend sent the token in the headers
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token is real and hasn't expired
    jwt.verify(token, process.env.JWT_SECRET);
    next(); // Let them through to the dashboard data
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ==========================================
// 7. ADMIN DASHBOARD (Results) 
// ==========================================
app.get('/admin/results', verifyAdmin, async (req, res) => {
  try {
    // We changed the ORDER BY inside json_agg to sort by n.id (original ballot order)
    const query = `
      SELECT 
        c.id as category_id, 
        c.name as category_name,
        json_agg(
          json_build_object(
            'nominee_id', n.id, 
            'name', n.name, 
            'votes', COALESCE(v.vote_count, 0)
          ) ORDER BY n.id ASC
        ) as results
      FROM categories c
      JOIN nominees n ON c.id = n.category_id
      LEFT JOIN (
        SELECT nominee_id, COUNT(id) as vote_count 
        FROM ballot_votes 
        GROUP BY nominee_id
      ) v ON n.id = v.nominee_id
      GROUP BY c.id, c.name
      ORDER BY c.id;
    `;
    
    const result = await pool.query(query);
    
    const totalVotesRes = await pool.query('SELECT COUNT(id) FROM ballots');
    const totalBallots = parseInt(totalVotesRes.rows[0].count);

    res.json({
      total_ballots: totalBallots,
      categories: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard results.' });
  }
});

// ==========================================
// 8. ADMIN DASHBOARD (Voter Status)
// ==========================================
app.get('/admin/voters', verifyAdmin, async (req, res) => {
  try {
    // total users generated
    const totalRes = await pool.query('SELECT COUNT(*) FROM users');
    
    // users who have successfully voted (link is burned)
    const votedRes = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = false');
    
    // users who have NOT voted yet
    const pendingRes = await pool.query('SELECT student_id FROM users WHERE is_active = true ORDER BY student_id ASC');

    res.json({
      total_users: parseInt(totalRes.rows[0].count),
      voted_count: parseInt(votedRes.rows[0].count),
      pending_users: pendingRes.rows.map(row => row.student_id)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch voter status.' });
  }
});

app.listen(port, () => {
  console.log(`apivote server running on port ${port}`);
});