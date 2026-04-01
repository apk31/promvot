require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const helmet = require('helmet'); // <-- 1. Import Helmet
const rateLimit = require('express-rate-limit'); // <-- 2. Import Rate Limiter
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 5000;

const hasAdminAuthConfig = () => {
  return Boolean(process.env.JWT_SECRET && process.env.ADMIN_PASSWORD);
};

const hashMagicToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// app.use(cors());
// app.use(express.json());
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
    credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', 1);

// 3. The Anti-Brute Force Bouncer
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes memory
  max: 5, // Limit each IP to 5 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 4. Token Verification Limiter (Prevent brute-forcing magic links)
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Max 30 attempts per IP
  message: { error: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 5. Vote Submission Limiter (Prevent spamming the database)
const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per IP
  message: { error: 'Too many voting attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// 1. VERIFY MAGIC LINK
// ==========================================
app.get('/verify-token/:token', tokenLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashMagicToken(token);
    const result = await pool.query(
      'SELECT id, student_id, is_active FROM users WHERE magic_token_hash = $1',
      [tokenHash]
    );

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
// 3. SUBMIT VOTE (The Ironclad Transaction) (Strict Validation)
// ==========================================
app.post('/vote', voteLimiter, async (req, res) => { // <-- P1 FIX: Added voteLimiter
  const { token, votes } = req.body;

  if (typeof token !== 'string' || token.length === 0) {
    return res.status(400).json({ error: 'Invalid token.' });
  }

  // 1. Basic array check
  if (!votes || !Array.isArray(votes) || votes.length === 0) {
    return res.status(400).json({ error: 'Invalid vote payload.' });
  }

  // 2. Prevent duplicate categories (e.g., sending [{cat: 1, nom: 2}, {cat: 1, nom: 3}])
  const uniqueCategories = new Set(votes.map(v => v.category_id));
  if (uniqueCategories.size !== votes.length) {
    return res.status(400).json({ error: 'Duplicate category votes detected.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3. Strict "No Abstain" Check
    const categoryCountRes = await client.query('SELECT COUNT(*) FROM categories');
    const totalCategories = parseInt(categoryCountRes.rows[0].count);

    if (votes.length !== totalCategories) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Incomplete ballot. You must vote in all ${totalCategories} categories.` 
      });
    }

    // --- P0 FIX START: Fetch valid nominee-category pairings ---
    const validNomineesRes = await client.query('SELECT id, category_id FROM nominees');
    const validNomineeMap = new Map();
    validNomineesRes.rows.forEach(row => {
      validNomineeMap.set(row.id, row.category_id);
    });
    // --- P0 FIX END ---

    // 4. Validate user token
    const tokenHash = hashMagicToken(token);
    const userRes = await client.query(
      'SELECT id, is_active FROM users WHERE magic_token_hash = $1 FOR UPDATE',
      [tokenHash]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid token.' });
    }
    if (!userRes.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already voted.' });
    }

    const userId = userRes.rows[0].id;
    const ballotRes = await client.query('INSERT INTO ballots (user_id) VALUES ($1) RETURNING id', [userId]);
    const ballotId = ballotRes.rows[0].id;

    // 5. Insert votes safely
    for (const vote of votes) {
      
      // --- P0 FIX START: Validate the pairing ---
      const expectedCategoryId = validNomineeMap.get(vote.nominee_id);
      if (expectedCategoryId !== vote.category_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid nominee for the specified category. Ballot rejected.' });
      }
      // --- P0 FIX END ---

      await client.query(
        'INSERT INTO ballot_votes (ballot_id, category_id, nominee_id) VALUES ($1, $2, $3)',
        [ballotId, vote.category_id, vote.nominee_id]
      );
    }

    // Burn the token AND log the timestamp!
    await client.query('UPDATE users SET is_active = false, used_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    await client.query('COMMIT');

    res.json({ message: 'Vote successfully recorded!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Voting Error:', err);
    res.status(500).json({ error: 'Failed to submit vote.' });
  } finally {
    client.release();
  }
});
// ==========================================
// 4. DEV ROUTE: GENERATE TEST USER
// ==========================================
// (Remove this before real voting starts!)
// app.post('/dev/generate-user', async (req, res) => {
//   try {
//     for (let i = 0; i < 11; i++) {
//       for (let j = 0; j < 5; j++) {
//         const studentId = `TEST${i.toString().padStart(2, '0')}-${j.toString().padStart(2, '0')}`;
//         const magicToken = `test${i.toString().padStart(2, '0')}-token-${j.toString().padStart(2, '0')}`;
//         await pool.query(
//           'INSERT INTO users (student_id, magic_token) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING',
//         [studentId, magicToken]
//         );
//         res.json({ message: `Test user created! Magic link will be: /vote/${magicToken}` });  
//       }
//     }
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// ==========================================
// 5. ADMIN LOGIN ROUTE (Now Protected)
// ==========================================
// Pass the `loginLimiter` middleware right before the route logic
app.post('/admin/login', loginLimiter, (req, res) => {
  try {
    const { password } = req.body;
    
    if (!hasAdminAuthConfig()) {
      console.error('CRITICAL ERROR: Admin auth environment variables are missing.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    if (password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
      
      // SET THE HTTP-ONLY COOKIE HERE
    res.cookie('adminToken', token, {
      httpOnly: true, // Invisible to JavaScript (XSS Protection)
      secure: process.env.NODE_ENV === 'production', // Requires HTTPS in prod
      sameSite: 'lax', // Protects against CSRF
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });
      
      res.json({ message: 'Login successful' });
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
  const token = req.cookies.adminToken;
  
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

app.post('/admin/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ message: 'Logged out' });
});
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
// ==========================================
// 9. ADMIN DASHBOARD (Detailed Voter Logs)
// ==========================================
app.get('/admin/voters/detail', verifyAdmin, async (req, res) => {
  try {
    const query = `
      SELECT student_id, is_active, used_at 
      FROM users 
      ORDER BY student_id ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch voter details.' });
  }
});

app.listen(port, () => {
  if (!hasAdminAuthConfig()) {
    console.warn('Warning: admin authentication is disabled until JWT_SECRET and ADMIN_PASSWORD are configured.');
  }
  console.log(`apivote server running on port ${port}`);
});
