const fs = require('fs');
const path = require('path');
const batchInfo = JSON.parse(process.env.BATCH_INFO);

let successfulRepos = [];
let failedRepos = [];
const dir = `batch-${batchInfo.batchNumber}-status`;

if (fs.existsSync(`./${dir}`)) {
    fs.readdirSync(`./${dir}`).forEach(file => {
    if (path.extname(file) === '.txt') {
        let [repo, status] = fs.readFileSync(`${dir}/${file}`, 'utf-8').split(',');
        if (status.trim() === 'success') {
        successfulRepos.push(repo);
        } else {
        failedRepos.push(repo);
        }
    }
    });
}

const batchStatus = {
    batchNumber: batchInfo.batchNumber,
    totalBatches: batchInfo.totalBatches,
    successful: successfulRepos,
    failed: failedRepos,
    totalProcessed: successfulRepos.length + failedRepos.length,
    migrationId: batchInfo.migrationId,
    migrationType: batchInfo.migrationType
};

fs.writeFileSync(`batch-${batchInfo.batchNumber}-status.json`, JSON.stringify(batchStatus, null, 2));

// Post summary comment to the original issue
const successIcon = failedRepos.length === 0 ? ':white_check_mark:' : ':warning:';
let body = `${successIcon} **Batch ${batchInfo.batchNumber} of ${batchInfo.totalBatches} Complete**\n\n`;
body += `**Successful:** ${successfulRepos.length}\n`;
body += `**Failed:** ${failedRepos.length}\n`;
body += `**Total:** ${successfulRepos.length + failedRepos.length}\n\n`;

if (failedRepos.length > 0) {
    body += `**Failed Repositories:**\n\`\`\`\n${failedRepos.slice(0, 10).join('\n')}`;
    if (failedRepos.length > 10) {
    body += `\n... and ${failedRepos.length - 10} more`;
    }
    body += `\n\`\`\`\n\n`;
    body += `💡 **Tip:** You can re-run this batch by manually triggering the migration-batch-processor workflow.`;
}

body += `\n\n[View batch details →](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})`;

await github.rest.issues.createComment({
    issue_number: batchInfo.issueNumber,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body
});