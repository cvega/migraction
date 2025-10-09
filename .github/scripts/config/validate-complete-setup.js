module.exports = async ({ github, context, core }) => {
  const { loadConfig, extractJson } = require('../utils/common.js');
  
  console.log('=== Validating Complete Migration Setup ===');
  
  const comments = await github.rest.issues.listComments({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo
  });
  
  // Find org state
  const stateComment = comments.data.find(c => 
    c.body.includes('✅ Organizations Selected') &&
    c.body.includes('📊 Configuration Data')
  );
  
  if (!stateComment) {
    await github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: `### ❌ Setup Incomplete\n\nPlease complete Step 2.`
    });
    core.setFailed('No org selection found');
    return;
  }
  
  const state = extractJson(stateComment.body);
  if (!state) {
    core.setFailed('Could not parse state JSON');
    return;
  }
  
  console.log(`Selected: ${state.sourceInstance}/${state.sourceOrg} → ${state.targetInstance}/${state.targetOrg}`);
  
  // Find repo list
  const repoComment = comments.data.find(c => 
    c.body.includes('✅ Repository List Received')
  );
  
  if (!repoComment) {
    await github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: `### ⚠️ Repository List Missing\n\nPlease complete Step 3.`
    });
    core.setFailed('No repository list');
    return;
  }
  
  const repoState = extractJson(repoComment.body);
  if (!repoState) {
    core.setFailed('Could not parse repo JSON');
    return;
  }
  
  const repos = repoState.repositories;
  console.log(`Found ${repos.length} repositories`);
  
  // Validate repos
  const config = loadConfig();
  const sourceConfig = config.sources[state.sourceInstance];
  
  if (!sourceConfig) {
    core.setFailed(`Unknown source instance: ${state.sourceInstance}`);
    return;
  }
  
  const expectedPrefix = `https://${sourceConfig.hostname}/${state.sourceOrg}/`;
  const invalidRepos = repos.filter(url => !url.startsWith(expectedPrefix));
  
  if (invalidRepos.length > 0) {
    await github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: `### ❌ Repository Mismatch\n\nRepos must start with: \`${expectedPrefix}\`\n\n${invalidRepos.map(u => `- ${u}`).join('\n')}`
    });
    core.setFailed('Invalid repos');
    return;
  }
  
  console.log('✅ All validations passed');
  
  core.setOutput('source_instance', state.sourceInstance);
  core.setOutput('source_org', state.sourceOrg);
  core.setOutput('target_instance', state.targetInstance);
  core.setOutput('target_org', state.targetOrg);
  core.setOutput('repository_urls', JSON.stringify(repos));
  core.setOutput('repository_count', repos.length.toString());
};