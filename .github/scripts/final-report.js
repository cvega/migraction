module.exports = async ({github, context}) => {
    const batchCount = '${{ needs.prepare.outputs.batch_count }}' || '0';
    const migrationType = '${{ needs.prepare.outputs.migration_type }}' || 'unknown';

    console.log('Debug - batchCount:', batchCount);
    console.log('Debug - migrationType:', migrationType);

    let body = `## ${migrationType.charAt(0).toUpperCase() + migrationType.slice(1)} Migration Orchestration Complete\n\n`;
    body += `**Total Batches:** ${batchCount}\n`;
    body += `**Processing:** Sequential (one batch at a time)\n\n`;
    body += `### Batch Results\n\n`;
    body += `Each batch ran as a separate workflow. Check individual batch workflows for detailed results:\n\n`;
    body += `[View all batch workflows →](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions?query=event%3Arepository_dispatch)\n\n`;

    if (migrationType === 'dry-run') {
        body += `---\n\n### Next Steps\n\nTo run the production migration:\n\`\`\`\n/run-production-migration\n\`\`\`\n\nTo delete the dry-run repositories:\n\`\`\`\n/delete-repositories\n\`\`\``;
    }

    body += `\n\n### Re-running Failed Batches\n\nIf any batches failed, you can re-run them individually by triggering the migration-batch-processor workflow manually with the specific batch data.`;

    await github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body
    });
}