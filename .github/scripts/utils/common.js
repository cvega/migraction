const fs = require('fs');

/**
 * Load instances.json config
 */
function loadConfig() {
  return JSON.parse(fs.readFileSync('.github/config/instances.json', 'utf8'));
}

/**
 * Parse repository URLs from text (still needed in parse-repos.yml)
 */
function parseRepoUrls(text) {
  const cleanedText = text
    .replace(/<details[^>]*>/gi, '')
    .replace(/<\/details>/gi, '')
    .replace(/<summary[^>]*>/gi, '')
    .replace(/<\/summary>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  return cleanedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (line.includes('<') && line.includes('>')) return false;
      if (line.startsWith('#') && !line.includes('://')) return false;
      return line.includes('://') || line.includes('github.');
    });
}

/**
 * Extract JSON from markdown code block
 */
function extractJson(commentBody) {
  const match = commentBody.match(/```json\n([\s\S]*?)\n```/);
  return match ? JSON.parse(match[1]) : null;
}

module.exports = {
  loadConfig,
  parseRepoUrls,
  extractJson
};