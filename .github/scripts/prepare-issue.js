module.exports = async ({github, context, core, env}) => {
    // if process.env.VISIBILITY is 'None', set it to 'private'
    let visibility
    if (process.env.VISIBILITY == 'None') {
        visibility = 'Private'
    } else {
        visibility = process.env.VISIBILITY
    }

    // Get the raw repository text
    const repoText = process.env.REPOSITORIES || '';

    console.log('=== DEBUG REPOSITORIES ===');
    console.log('REPOSITORIES exists:', !!process.env.REPOSITORIES);
    console.log('Length:', repoText.length);
    console.log('First 500 chars:', repoText.substring(0, 500));
    console.log('=== END DEBUG ===');

    // Remove ONLY the HTML tags, not the content
    const cleanedText = repoText
        .replace(/<details[^>]*>/gi, '')  // Remove opening details tag
        .replace(/<\/details>/gi, '')     // Remove closing details tag
        .replace(/<summary[^>]*>/gi, '')  // Remove opening summary tag
        .replace(/<\/summary>/gi, '')     // Remove closing summary tag
        .replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments

    // Now split and filter the cleaned text
    const repoLines = cleanedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
        // Only count non-empty lines that look like URLs
        if (!line) return false;
        
        // Additional safety check for any remaining HTML
        if (line.includes('<') && line.includes('>')) return false;
        
        // Filter out markdown headers without URLs
        if (line.startsWith('#') && !line.includes('://')) return false;
        
        // Basic check for URL-like content
        return line.includes('://') || line.includes('github.');
        });

    const numberOfRepositories = repoLines.length;

    // Optional: Log for debugging
    console.log(`Original text length: ${repoText.length}`);
    console.log(`Cleaned text length: ${cleanedText.length}`);
    console.log(`Total lines in original: ${repoText.split('\n').length}`);
    console.log(`Valid repositories found: ${numberOfRepositories}`);
    if (repoText !== cleanedText) {
        console.log('HTML blocks were removed from the input');
    }

    let commentBody
    commentBody = `👋 Thank you for opening this migration issue.

    **${numberOfRepositories} repositories** have been parsed from your issue body

    The **target organization** is set to be: **\`${ process.env.TARGET_ORG }\`**
    The **target repository visibility** is set to be: **\`${ visibility }\`**

    <details>
        <summary><b>Troubleshooting</b></summary>

    If the parsed repositories are not matching the repositories listed in your issue body, you can edit the issue body or open a new issue using an issue template.
    </details>

    ## Run the migration

    Add a comment to this issue with one of the following two commands in order to run a migration:

    **Dry-run**

    We recommend to do a "dry-run" migration first which **will not lock your source repository** and therefore does not block your users from continuing to work on the repository.

    \`\`\`
    /run-dry-run-migration
    \`\`\`

    **Production**

    After you have verified your "dry-run" migration and after you have announced the production migration to your users, create a comment with the following command to start the production migration. It **will lock your source repository** and make it unaccessible for your users.

    \`\`\`
    /run-production-migration
    \`\`\`
    `

    // For repositories migrating with GEI, inform about batching
    const labelsResponse = await github.rest.issues.listLabelsOnIssue({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo
    });
    const labels = labelsResponse.data.map(label => label.name);

    if (labels.some(label => label.includes('gei')) && numberOfRepositories > 200) {
        const batches = Math.ceil(numberOfRepositories / 200);
        commentBody += `
        
        ---
        
        **📦 Batch Processing Information**
        
        Since you're migrating **${numberOfRepositories} repositories**, they will be processed in **${batches} sequential batches** of up to 200 repositories each to ensure reliable migration. You'll receive progress updates as each batch is processed.
        `
    }
                
    await github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: commentBody
    })
}