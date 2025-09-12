module.exports = async ({ github, context, core }) => {
    const issueNumber = context.issue.number;
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    // Get all comments from the issue
    const comments = await github.rest.issues.listComments({
        issue_number: issueNumber,
        owner: context.repo.owner,
        repo: context.repo.repo,
        since: startTime.toISOString(),
        per_page: 100
    });
    
    // Parse comments to find LFS, packages, and releases migrations
    const features = {
        lfs: { started: [], completed: [], failed: [] },
        packages: { started: [], completed: [], failed: [] },
        releases: { started: [], completed: [], failed: [] }
    };
    
    comments.data.forEach(comment => {
        const body = comment.body;
        
        // Check for LFS migrations
        if (body.includes('LFS Migration')) {
            const repoMatch = body.match(/\*\*Repository:\*\* `([^`]+)`/);
            const repo = repoMatch ? repoMatch[1] : 'unknown';
            
            if (body.includes('LFS Migration Starting')) {
                features.lfs.started.push(repo);
            } else if (body.includes('✅ LFS Migration completed successfully')) {
                features.lfs.completed.push(repo);
            } else if (body.includes('❌ LFS Migration failed')) {
                features.lfs.failed.push(repo);
            }
        }
        
        // Check for Package migrations
        if (body.includes('Package Migration')) {
            const repoMatch = body.match(/\*\*Repository:\*\* `([^`]+)`/);
            const repo = repoMatch ? repoMatch[1] : 'unknown';
            
            if (body.includes('Package Migration Starting')) {
                features.packages.started.push(repo);
            } else if (body.includes('✅ Package Migration completed successfully')) {
                features.packages.completed.push(repo);
            } else if (body.includes('❌ Package Migration failed')) {
                features.packages.failed.push(repo);
            }
        }
        
        // Check for Releases migrations
        if (body.includes('Releases Migration')) {
            const repoMatch = body.match(/\*\*Repository:\*\* `([^`]+)`/);
            const repo = repoMatch ? repoMatch[1] : 'unknown';
            
            if (body.includes('Releases Migration Starting')) {
                features.releases.started.push(repo);
            } else if (body.includes('✅ Releases Migration completed successfully')) {
                features.releases.completed.push(repo);
            } else if (body.includes('❌ Releases Migration failed')) {
                features.releases.failed.push(repo);
            }
        }
    });
    
    // Generate summary
    let summaryBody = `## 📊 Special Features Migration Summary\n\n`;
    
    // LFS Summary
    if (features.lfs.started.length > 0) {
        summaryBody += `### 📦 Git LFS Migrations\n`;
        summaryBody += `| Status | Count | Repositories |\n`;
        summaryBody += `|--------|-------|-------------|\n`;
        summaryBody += `| ✅ Completed | ${features.lfs.completed.length} | ${features.lfs.completed.join(', ') || 'None'} |\n`;
        summaryBody += `| ❌ Failed | ${features.lfs.failed.length} | ${features.lfs.failed.join(', ') || 'None'} |\n`;
        summaryBody += `| ⏳ In Progress | ${features.lfs.started.length - features.lfs.completed.length - features.lfs.failed.length} | - |\n\n`;
    }
    
    // Packages Summary
    if (features.packages.started.length > 0) {
        summaryBody += `### 📦 Package Migrations\n`;
        summaryBody += `| Status | Count | Repositories |\n`;
        summaryBody += `|--------|-------|-------------|\n`;
        summaryBody += `| ✅ Completed | ${features.packages.completed.length} | ${features.packages.completed.join(', ') || 'None'} |\n`;
        summaryBody += `| ❌ Failed | ${features.packages.failed.length} | ${features.packages.failed.join(', ') || 'None'} |\n`;
        summaryBody += `| ⏳ In Progress | ${features.packages.started.length - features.packages.completed.length - features.packages.failed.length} | - |\n\n`;
    }
    
    // Releases Summary
    if (features.releases.started.length > 0) {
        summaryBody += `### 🏷️ Releases Migrations\n`;
        summaryBody += `| Status | Count | Repositories |\n`;
        summaryBody += `|--------|-------|-------------|\n`;
        summaryBody += `| ✅ Completed | ${features.releases.completed.length} | ${features.releases.completed.join(', ') || 'None'} |\n`;
        summaryBody += `| ❌ Failed | ${features.releases.failed.length} | ${features.releases.failed.join(', ') || 'None'} |\n`;
        summaryBody += `| ⏳ In Progress | ${features.releases.started.length - features.releases.completed.length - features.releases.failed.length} | - |\n\n`;
    }
    
    // Post summary if any special features were migrated
    if (features.lfs.started.length > 0 || features.packages.started.length > 0 || features.releases.started.length > 0) {
        await github.rest.issues.createComment({
            issue_number: issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: summaryBody
        });
        
        return true;
    }
    
    return false;
};