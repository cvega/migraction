const repoData = ${{ steps.parse-issue-body.outputs.jsonString }};
const repositories = repoData._repositories || repoData._repositories_to_migrate || '';

// Parse repositories
const cleanedText = repositories
  .replace(/<details[^>]*>/gi, '')
  .replace(/<\/details>/gi, '')
  .replace(/<summary[^>]*>/gi, '')
  .replace(/<\/summary>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const repoUrls = cleanedText
  .split('\n')
  .map(line => line.trim())
  .filter(line => {
    if (!line) return false;
    if (line.includes('<') && line.includes('>')) return false;
    if (line.startsWith('#') && !line.includes('://')) return false;
    return line.includes('://') || line.includes('github.');
  });

const repoNames = repoUrls.map(url => {
  const parts = url.split('/');
  return parts[parts.length - 1];
});

core.setOutput('repo_count', repoNames.length);
core.setOutput('repo_names', JSON.stringify(repoNames));

const body = `### ⚠️ Confirm Repository Deletion

**You are about to delete ${repoNames.length} repositories from \`${{ vars.TARGET_ORGANIZATION }}\`**

<details>
<summary><b>📋 Repositories to be deleted</b></summary>

${repoNames.map((repo, index) => `${index + 1}. \`${repo}\``).join('\n')}

</details>

---

**⚠️ WARNING:** This action is **IRREVERSIBLE**. All repository data will be permanently deleted.

To confirm deletion, reply with:
\`\`\`
/confirm-delete
\`\`\`

To cancel, reply with:
\`\`\`
/cancel-delete
\`\`\`

This request will expire in 5 minutes.`;
            
await github.rest.issues.createComment({
  issue_number: context.issue.number,
  owner: context.repo.owner,
  repo: context.repo.repo,
  body
});

// Store the comment ID and timestamp for verification
core.setOutput('confirm_comment_id', context.payload.comment.id);
core.setOutput('confirm_timestamp', new Date().toISOString());
        
  