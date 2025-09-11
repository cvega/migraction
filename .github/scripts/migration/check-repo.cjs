/**
 * Check if a repository exists in a CSV file (exact match)
 * Usage: node check-csv-repo.cjs <csv-file> <repo-name>
 */
const fs = require('fs');

// Get command line arguments
const csvFile = process.argv[2];  // CSV file to check
const filter = process.argv[3];   // Repository name to search for (exact match)

// Check if file exists
if (!fs.existsSync(csvFile)) {
  console.log('found=false');
  process.exit(0);
}

// Read and parse CSV
const content = fs.readFileSync(csvFile, 'utf8').trim();

// Handle empty file
if (!content) {
  console.log('found=false');
  process.exit(0);
}

const lines = content.split('\n').filter(line => line.trim());

// Handle no data
if (lines.length === 0) {
  console.log('found=false');
  process.exit(0);
}

// Parse headers
const headers = lines[0].split(',').map(h => h.replace(/"/g, '').toLowerCase().trim());
const repoIndex = headers.findIndex(h => h.includes('repository'));

// Handle missing repository column
if (repoIndex === -1) {
  console.log('found=false');
  process.exit(0);
}

// Handle no data rows
if (lines.length <= 1) {
  console.log('found=false');
  process.exit(0);
}

// Extract repository names from data rows
const repos = lines.slice(1)
  .filter(line => line.trim()) // Skip empty lines
  .map(line => {
    const columns = line.split(',');
    // Check if this row has enough columns
    if (columns.length > repoIndex && columns[repoIndex]) {
      return columns[repoIndex].replace(/"/g, '').trim();
    }
    return null;
  })
  .filter(repo => repo !== null); // Remove null entries

// Check for exact match
const found = repos.some(repo => repo === filter);
console.log(`found=${found}`);
