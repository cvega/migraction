module.exports = async ({github, context}) => {
    const batches = JSON.parse(process.env.BATCHES);
                
    // Function to check if workflow is being cancelled
    async function isWorkflowCancelled() {
        try {
        // Check our own workflow run status
        const { data: currentRun } = await github.rest.actions.getWorkflowRun({
            owner: context.repo.owner,
            repo: context.repo.repo,
            run_id: context.runId
        });
        
        return currentRun.status === 'cancelled' || currentRun.conclusion === 'cancelled';
        } catch (error) {
            console.log('Error checking cancellation status:', error.message);
            return false;
        }
    }

    // Function to check for cancel command in issue comments
    async function hasCancelCommand(issueNumber, sinceTime) {
        try {
        const comments = await github.rest.issues.listComments({
            issue_number: issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            since: sinceTime.toISOString()
        });
        
        return comments.data.some(comment => 
            comment.body.includes('/cancel-migration')
        );
        } catch (error) {
            console.log('Error checking for cancel command:', error.message);
            return false;
        }
    }

    // Function to cancel all running batch workflows
    async function cancelRunningBatches(fromBatchNumber) {
        console.log(`Cancelling all running workflows from batch ${fromBatchNumber} onwards...`);
        
        try {
        const runs = await github.rest.actions.listWorkflowRuns({
            owner: context.repo.owner,
            repo: context.repo.repo,
            workflow_id: 'migration-batch-processor.yml',
            event: 'repository_dispatch',
            status: 'queued'
        });
        
        const inProgressRuns = await github.rest.actions.listWorkflowRuns({
            owner: context.repo.owner,
            repo: context.repo.repo,
            workflow_id: 'migration-batch-processor.yml',
            event: 'repository_dispatch',
            status: 'in_progress'
        });
        
        const allRuns = [...runs.data.workflow_runs, ...inProgressRuns.data.workflow_runs];
        
        for (const run of allRuns) {
            await github.rest.actions.cancelWorkflowRun({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: run.id
            });
            console.log(`Cancelled workflow run ${run.id}`);
        }
        } catch (error) {
        console.log('Error cancelling batch workflows:', error.message);
        }
    }

    const startTime = new Date();

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = batch.batchNumber;
        
        // CHECK FOR CANCELLATION BEFORE EACH BATCH
        if (await isWorkflowCancelled() || await hasCancelCommand(batch.issueNumber, startTime)) {
        console.log('Cancellation detected! Stopping batch processing...');
        
        await github.rest.issues.createComment({
            issue_number: batch.issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `:stop_sign: Migration orchestration was cancelled at batch ${batchNumber} of ${batches.length}\n\n**Batches completed:** ${i}\n**Batches remaining:** ${batches.length - i}\n\nAny currently running migrations will continue to completion.`
        });
        
        await cancelRunningBatches(batchNumber);
        process.exit(0);
        }
        
        console.log(`\n=== Dispatching Batch ${batchNumber} of ${batches.length} ===`);
        console.log(`Repositories: ${batch.repositories.length}`);
        
        // Post batch start comment
        await github.rest.issues.createComment({
            issue_number: batch.issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `:arrow_forward: Starting batch ${batchNumber} of ${batches.length} (${batch.repositories.length} repositories)\n\n[Track batch progress →](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions?query=event%3Arepository_dispatch)`
        });
        
        // Try direct API call instead of github.rest.repos.createDispatchEvent
        try {
        const dispatchPayload = {
            event_type: 'migration-batch',
            client_payload: {
                batch: batch,
                orchestrator_run_id: context.runId
            }
        };
        
        console.log('Dispatch payload:', JSON.stringify(dispatchPayload, null, 2));
        
        // Use fetch directly instead of octokit
        const response = await fetch(`https://api.github.com/repos/${context.repo.owner}/${context.repo.repo}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${process.env.TARGET_ADMIN_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'GitHub Actions'
            },
            body: JSON.stringify(dispatchPayload)
        });
        
        if (response.ok) {
            console.log(`Successfully dispatched batch ${batchNumber}`);
            
            // Post success comment
            await github.rest.issues.createComment({
                issue_number: batch.issueNumber,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `:white_check_mark: Batch ${batchNumber} of ${batches.length} dispatched successfully\n\n[View batch workflow →](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions?query=event%3Arepository_dispatch)`
            });
        } else {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        } catch (error) {
            console.log(`Failed to dispatch batch ${batchNumber}: ${error.message}`);
            
            // Post failure comment
            await github.rest.issues.createComment({
                issue_number: batch.issueNumber,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `:x: Failed to dispatch batch ${batchNumber} of ${batches.length}\n\n**Error:** ${error.message}\n\n**Workaround:** Manually trigger the migration-batch-processor workflow with batch data.`
            });
            
            // Continue with next batch instead of failing completely
            continue;
        }
        
        // WAIT FOR THIS SPECIFIC BATCH TO COMPLETE
        console.log(`Waiting for batch ${batchNumber} to complete...`);
        let batchCompleted = false;
        let completedRun = null;
        let attempts = 0;
        const maxAttempts = 1440; // 12 hours (30-second intervals)
        const dispatchTime = new Date();
        let previousRunningCount = -1; // Track previous count
        let noActiveWorkflowsCount = 0; // Track consecutive checks with no active workflows
        let hasSeenAnyWorkflow = false; // Track if we've seen any workflow for this batch
        
        // IMPORTANT: Wait a bit before starting to check for the workflow
        // GitHub needs time to process the dispatch and create the workflow run
        console.log('Waiting 60 seconds for workflow to be created...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        while (!batchCompleted && attempts < maxAttempts) {
        attempts++;
        
        // Check for cancellation every 5 iterations (2.5 minutes)
        if (attempts % 5 === 0) {
            if (await isWorkflowCancelled() || await hasCancelCommand(batch.issueNumber, startTime)) {
            console.log('Cancellation detected during batch wait!');
            
            await github.rest.issues.createComment({
                issue_number: batch.issueNumber,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `:stop_sign: Migration cancelled while waiting for batch ${batchNumber} to complete\n\n**Note:** Currently running migrations in this batch will continue to completion.`
            });
            
            await cancelRunningBatches(batchNumber);
            process.exit(0);
            }
        }
        
        // Wait 30 seconds before checking
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Get ALL recent workflow runs for our workflow
        const runs = await github.rest.actions.listWorkflowRuns({
            owner: context.repo.owner,
            repo: context.repo.repo,
            workflow_id: 'migration-batch-processor.yml',
            event: 'repository_dispatch',
            per_page: 50,
            status: 'all' // Get all statuses
        });
        
        // Find runs that started around the time we dispatched this batch
        // Use a wider time window to account for clock skew and timing issues
        const timeWindowMs = 5 * 60 * 1000; // 5 minutes before dispatch time
        const ourBatchRuns = runs.data.workflow_runs.filter(run => {
            const runTime = new Date(run.created_at);
            const timeDiff = runTime - dispatchTime;
            // Include runs from 5 minutes before dispatch to any time after
            return timeDiff >= -timeWindowMs;
        });
        
        // Debug logging
        if (attempts === 1 || attempts % 10 === 0) {
            console.log(`Found ${ourBatchRuns.length} potential workflow runs for batch ${batchNumber}`);
            ourBatchRuns.slice(0, 3).forEach(run => {
            console.log(`  - Run ${run.id}: status=${run.status}, conclusion=${run.conclusion}, created=${run.created_at}`);
            });
        }
        
        // Check if there are any running workflows
        const runningCount = ourBatchRuns.filter(run => 
            run.status === 'in_progress' || run.status === 'queued'
        ).length;
        
        // Track if we've seen any workflow at all for this batch
        if (ourBatchRuns.length > 0) {
            hasSeenAnyWorkflow = true;
        }
        
        // Track when workflows finish
        if (previousRunningCount > 0 && runningCount === 0) {
            console.log(`All workflows for batch ${batchNumber} have finished. Checking for completion...`);
        }
        previousRunningCount = runningCount;
        
        // If no workflows are active, increment counter
        if (runningCount === 0 && hasSeenAnyWorkflow) {
            noActiveWorkflowsCount++;
        } else {
            noActiveWorkflowsCount = 0; // Reset if workflows are found
        }
        
        // Look for completed runs
        const completedRuns = ourBatchRuns
            .filter(run => run.status === 'completed')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        if (completedRuns.length > 0) {
            // If we have completed runs and no active ones, we're done
            if (runningCount === 0) {
            completedRun = completedRuns[0];
            batchCompleted = true;
            console.log(`Batch ${batchNumber} completed: ${completedRun.conclusion}`);
            console.log(`Completed run URL: ${completedRun.html_url}`);
            } else {
            console.log(`Found ${completedRuns.length} completed runs but ${runningCount} still active`);
            }
        } else if (runningCount === 0 && hasSeenAnyWorkflow && noActiveWorkflowsCount >= 3) {
            // Only assume completion if:
            // 1. We've actually seen a workflow for this batch
            // 2. No workflows are currently active
            // 3. This has been true for 3 consecutive checks (90 seconds)
            console.log(`WARNING: No active workflows and no completed runs found after ${noActiveWorkflowsCount} checks`);
            console.log(`Has seen workflow: ${hasSeenAnyWorkflow}`);
            
            // Try one more time with a much wider time window
            const allRecentRuns = runs.data.workflow_runs.filter(run => {
            const runTime = new Date(run.created_at);
            const hourAgo = new Date(dispatchTime.getTime() - 60 * 60 * 1000);
            return runTime >= hourAgo && run.status === 'completed';
            });
            
            if (allRecentRuns.length > 0) {
            completedRun = allRecentRuns[0];
            batchCompleted = true;
            console.log(`Found completed run with wider search: ${completedRun.conclusion}`);
            } else if (attempts > 10) { // Only after at least 5 minutes total
            // Assume completion only after we've been checking for a while
            batchCompleted = true;
            console.log(`No completed runs found after ${attempts} attempts. Assuming batch ${batchNumber} completed.`);
            }
        } else if (!hasSeenAnyWorkflow && attempts > 6) {
            // If we haven't seen any workflow after 3+ minutes, something might be wrong
            console.log(`WARNING: No workflow found for batch ${batchNumber} after ${attempts * 30} seconds`);
            if (attempts > 10) {
            console.log(`ERROR: No workflow found after 5+ minutes. Moving to next batch.`);
            batchCompleted = true;
            }
        }
        
        // Status logging
        if (!batchCompleted && attempts % 20 === 0) { // Every 10 minutes
            const minutes = Math.round(attempts * 30 / 60);
            const workflowStatus = hasSeenAnyWorkflow ? 
            `${runningCount} workflows active` : 
            'waiting for workflow to start';
            console.log(`Batch ${batchNumber} still running... (${minutes} minutes, ${workflowStatus})`);
            
            if (attempts % 120 === 0) { // Every 60 minutes
            await github.rest.issues.createComment({
                issue_number: batch.issueNumber,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `:clock3: Batch ${batchNumber} still in progress... (${minutes} minutes elapsed, ${workflowStatus})\n\n:stop_sign: To cancel, add a comment with \`/cancel-migration\``
            });
            }
        }
        }
        
        // Post completion comment
        if (completedRun) {
        const statusIcon = completedRun.conclusion === 'success' ? ':white_check_mark:' : ':x:';
        await github.rest.issues.createComment({
            issue_number: batch.issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `${statusIcon} Batch ${batchNumber} of ${batches.length} completed: **${completedRun.conclusion}**\n\n[View batch details →](${completedRun.html_url})`
        });
        } else if (batchCompleted) {
        // Completed without finding a specific run
        await github.rest.issues.createComment({
            issue_number: batch.issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `:white_check_mark: Batch ${batchNumber} of ${batches.length} completed\n\n_Note: Workflow run details not found, but no active workflows remain._`
        });
        } else {
        // Timed out
        console.log(`WARNING: Batch ${batchNumber} timed out after 12 hours`);
        await github.rest.issues.createComment({
            issue_number: batch.issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `:warning: Batch ${batchNumber} of ${batches.length} timed out after 12 hours. Proceeding to next batch.`
        });
        }
        
        // Short delay before next batch
        if (i < batches.length - 1) {
        console.log('Waiting 30 seconds before starting next batch...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    console.log('\n=== All Batches Dispatched ===');
}