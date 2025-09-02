/**
 * Check if a repository exists in a CSV file (exact match)
 * Usage: node check-csv-repo.cjs <csv-file> <repo-name>
 */

const fs = require('fs');

// Get command line arguments
const csvFile = process.argv[2];  // CSV file to check
const filter = process.argv[3];   // Repository name to search for (exact match)

// Read and parse CSV
const lines = fs.readFileSync(csvFile, 'utf8').split('\n');
const headers = lines[0].split(',').map(h => h.replace(/"/g, '').toLowerCase());
const repoIndex = headers.findIndex(h => h.includes('repository'));

// Extract repository names from data rows
const repos = lines.slice(1)
  .map(line => line.split(',')[repoIndex].replace(/"/g, ''));

// Check for exact match
const found = repos.some(repo => repo === filter);

console.log(`found=${found}`);
