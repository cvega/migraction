module.exports = async ({ github, context }) => {
  const body = `## 📋 Step 3: Provide Repository URLs

After selecting your organizations above, provide the repositories to migrate.

**Reply to this issue with:**

\`\`\`
repos:
https://github.com/your-org/repo1
https://github.com/your-org/repo2
https://github.com/your-org/repo3
\`\`\`

**Format:**
- Start with \`repos:\`
- One URL per line
- Full HTTPS URLs

---

## 🚀 Step 4: Run Migration

After providing repositories, run:

**Test migration (recommended first):**
\`\`\`
/run-dry-run-migration
\`\`\`

**Production migration:**
\`\`\`
/run-production-migration
\`\`\`

---

*Waiting for your repository list...*`;

  await github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: body
  });
};