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

**Format Requirements:**
- Start with \`repos:\` on its own line
- One repository URL per line
- Full HTTPS URLs (e.g., \`https://github.com/org/repo\`)
- URLs must match your selected source organization

**Example:**
\`\`\`
repos:
https://github.com/cloud-org-1/frontend-app
https://github.com/cloud-org-1/backend-api
https://github.com/cloud-org-1/mobile-app
\`\`\`

---

⏭️ **After posting your repository list, proceed to Step 4 for migration commands.**`;

  await github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: body
  });
};