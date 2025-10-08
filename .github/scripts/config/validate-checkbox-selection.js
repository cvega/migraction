module.exports = async ({ github, context, core }) => {
  const fs = require('fs');
  
  console.log('=== Validating Checkbox Selection ===');
  
  const commentBody = context.payload.comment.body;
  
  // Check if this is the org selection comment
  if (!commentBody.includes('📤 Source Organization') || 
      !commentBody.includes('📥 Target Organization')) {
    console.log('Not an org selection comment');
    core.setOutput('is_org_comment', 'false');
    return;
  }
  
  core.setOutput('is_org_comment', 'true');
  
  // Parse checkbox sections
  const sourceSection = commentBody.match(/📤[\s\S]*?📥/)?.[0] || '';
  const targetSection = commentBody.split('📥')[1] || '';
  
  const sourceChecked = sourceSection.match(/- \[x\]/gi)?.length || 0;
  const targetChecked = targetSection.match(/- \[x\]/gi)?.length || 0;
  
  console.log(`Source checked: ${sourceChecked}, Target checked: ${targetChecked}`);
  
  // Check if valid (exactly 1 of each)
  const isValid = sourceChecked === 1 && targetChecked === 1;
  core.setOutput('is_valid', isValid.toString());
  
  if (!isValid) {
    console.log('Invalid selection - not exactly 1 source and 1 target');
    
    if (sourceChecked === 0 || targetChecked === 0) {
      core.setOutput('error_type', 'none_selected');
    } else if (sourceChecked > 1 || targetChecked > 1) {
      core.setOutput('error_type', 'multiple_selected');
    }
    return;
  }
  
  // Extract selected orgs and instances
  let sourceInstance = null, sourceOrg = null;
  let targetInstance = null, targetOrg = null;
  let currentInstance = null;
  
  const sourceLines = sourceSection.split('\n');
  for (const line of sourceLines) {
    if (line.startsWith('**') && line.includes('**')) {
      const match = line.match(/\*\*([^*]+)\*\*/);
      if (match) currentInstance = match[1];
    } else if ((line.includes('- [x]') || line.includes('- [X]')) && currentInstance) {
      const orgMatch = line.match(/`([^`]+)`/);
      if (orgMatch) {
        sourceInstance = currentInstance;
        sourceOrg = orgMatch[1];
      }
    }
  }
  
  currentInstance = null;
  const targetLines = targetSection.split('\n');
  for (const line of targetLines) {
    if (line.startsWith('**') && line.includes('**')) {
      const match = line.match(/\*\*([^*]+)\*\*/);
      if (match) currentInstance = match[1];
    } else if ((line.includes('- [x]') || line.includes('- [X]')) && currentInstance) {
      const orgMatch = line.match(/`([^`]+)`/);
      if (orgMatch) {
        targetInstance = currentInstance;
        targetOrg = orgMatch[1];
      }
    }
  }
  
  console.log(`Selected: ${sourceInstance}/${sourceOrg} → ${targetInstance}/${targetOrg}`);
  
  // Load config to get hostnames
  const config = JSON.parse(fs.readFileSync('.github/config/instances.json', 'utf8'));
  const sourceHostname = config.sources[sourceInstance]?.hostname;
  const targetHostname = config.targets[targetInstance]?.hostname;
  
  // Set outputs
  core.setOutput('source_instance', sourceInstance);
  core.setOutput('source_org', sourceOrg);
  core.setOutput('source_hostname', sourceHostname);
  core.setOutput('target_instance', targetInstance);
  core.setOutput('target_org', targetOrg);
  core.setOutput('target_hostname', targetHostname);
  
  console.log('✅ Valid selection');
};