const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const exportDir = path.join(__dirname, 'exports');
const exportFile = path.join(exportDir, 'voter-links.csv');
const votingLinkBaseUrl = (process.env.VOTING_LINK_BASE_URL || 'http://localhost:5174/vote').replace(/\/+$/, '');

const generateMagicToken = () => {
  return crypto.randomBytes(16).toString('base64url');
};

const hashMagicToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const escapeCsvValue = (value) => {
  return `"${String(value).replace(/"/g, '""')}"`;
};

const buildVotingLink = (token) => {
  return `${votingLinkBaseUrl}#${encodeURIComponent(token)}`;
};

const setupDatabase = async () => {
  try {
    console.log('Starting database initialization...');

    // 1. Drop existing tables if they exist (Clean slate)
    await pool.query(`
      DROP TABLE IF EXISTS ballot_votes CASCADE;
      DROP TABLE IF EXISTS ballots CASCADE;
      DROP TABLE IF EXISTS nominees CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('Old tables dropped.');

    // 2. Create Tables
    await pool.query(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          student_id VARCHAR(20) UNIQUE NOT NULL,
          magic_token_hash VARCHAR(64) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          used_at TIMESTAMP
      );

      CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL
      );

      CREATE TABLE nominees (
          id SERIAL PRIMARY KEY,
          category_id INT REFERENCES categories(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          photo_url VARCHAR(255) DEFAULT ''
      );

      CREATE TABLE ballots (
          id SERIAL PRIMARY KEY,
          user_id INT UNIQUE REFERENCES users(id),
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE ballot_votes (
          id SERIAL PRIMARY KEY,
          ballot_id INT REFERENCES ballots(id) ON DELETE CASCADE,
          category_id INT REFERENCES categories(id),
          nominee_id INT REFERENCES nominees(id),
          UNIQUE(ballot_id, category_id)
      );
    `);
    console.log('New tables created.');

    // 3. Insert Categories
    await pool.query(`
      INSERT INTO categories (name) VALUES
      ('The Star Athlete'),
      ('The Life of The Party'),
      ('The Musical Mind'),
      ('Romeo and Juliet'),
      ('The Class Clown'),
      ('The Brightest Mind'),
      ('The Hopeless Romantic'),
      ('The Creative Soul'),
      ('The Shining All-Rounder');
    `);
    console.log('Categories seeded.');

    // 4. Insert Nominees
    await pool.query(`
      INSERT INTO nominees (category_id, name) VALUES
      (1, 'Louisa Antoinette Anabella'),
      (1, 'Yoel Christian Wibowo'),
      (1, 'Farrel Christian Arden'),

      (2, 'Nicholas Kent'),
      (2, 'Beatrice Livana Gunawan'),
      (2, 'Deinnilo Amertha Nugraha'),

      (3, 'Imanuel Willem Hermanto'),
      (3, 'Arelli Anara Raphael'),
      (3, 'Bagas Dwi Kristian'),

      (4, 'Farrel Christian Arden dan Christie Irene Cham'),
      (4, 'Yoel Christian Wibowo dan Violetta Olivia Chandra'),
      (4, 'Moses Stefano Rioli dan Elizabeth Nadya Kusuma'),

      (5, 'Sandro Surya Darma'),
      (5, 'Juan Imanuel Hamonangan Sirait'),
      (5, 'Christopher Jericho Arlen Abednego'),

      (6, 'Fiona Florence Chandra'),
      (6, 'Tamara Edina'),
      (6, 'Angela Stephanie Soetanto'),

      (7, 'Matthew Davon Oeitono'),
      (7, 'Albertus Christian Gunawan'),
      (7, 'Maxibillion Valfinn'),

      (8, 'Carlene Ivory Mandang'),
      (8, 'Philip Alexander Lincani'),
      (8, 'Cliff Rassen Dragon Owen'),

      (9, 'Wynnette Leanora'),
      (9, 'Alicia Charisa Giamsyah'),
      (9, 'Chelso Aurelio Purnomo');
    `);
    console.log('Nominees seeded.');

    // 5. Insert users and export plaintext links once.
    const exportRows = ['student_id,magic_token,voting_link'];

    for (let i = 0; i < 11; i++) {
      for (let j = 0; j < 5; j++) {
        const studentId = `TEST${i.toString().padStart(2, '0')}-${j.toString().padStart(2, '0')}`;
        const magicToken = generateMagicToken();
        const magicTokenHash = hashMagicToken(magicToken);
        const votingLink = buildVotingLink(magicToken);

        await pool.query(
          'INSERT INTO users (student_id, magic_token_hash) VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING',
          [studentId, magicTokenHash]
        );

        exportRows.push(
          [
            escapeCsvValue(studentId),
            escapeCsvValue(magicToken),
            escapeCsvValue(votingLink)
          ].join(',')
        );
      }
    }

    fs.mkdirSync(exportDir, { recursive: true });
    fs.writeFileSync(exportFile, `${exportRows.join('\n')}\n`, 'utf8');

    console.log(`Voter link export created at: ${exportFile}`);
    console.log('Database setup perfectly completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
};

setupDatabase();
