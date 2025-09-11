module.exports = async ({context, core}) => {
    const repoText = process.env.REPOS.trim();
    const cleanedText = repoText
        .replace(/<details[^>]*>/gi, '')
        .replace(/<\/details>/gi, '')
        .replace(/<summary[^>]*>/gi, '')
        .replace(/<\/summary>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    const repos = cleanedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
        if (!line) return false;
        if (line.includes('<') && line.includes('>')) return false;
        if (line.startsWith('#') && !line.includes('://')) return false;
        return line.includes('://') || line.includes('github.');
        });

    const batchSize = parseInt(process.env.BATCH_SIZE) || 5;
    const batchCount = Math.ceil(repos.length / batchSize);
    const batches = [];

    for (let i = 0; i < batchCount; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, repos.length);
        const batch = repos.slice(start, end);
        
        const batchData = {
            batchNumber: i + 1,
            repositories: batch,
            migrationId: process.env.MIGRATION_ID,
            issueNumber: context.issue.number,
            migrationType: process.env.MIGRATION_TYPE,
            targetOrganization: process.env.TARGET_ORG,
            targetRepositoryVisibility: process.env.VISIBILITY,
            installPrereqs: process.env.INSTALL_PREREQS,
            batchId: `batch-${i + 1}-${Date.now()}`,
            totalBatches: batchCount,
            totalRepos: repos.length
        };
                
        batches.push(batchData);
    }

    core.setOutput('batches', JSON.stringify(batches));
    core.setOutput('batch_count', batchCount);
    core.setOutput('total_repos', repos.length);
    console.log(`Created ${batchCount} batches for ${repos.length} repositories`);
}