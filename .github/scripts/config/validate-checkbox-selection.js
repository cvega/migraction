module.exports = async ({ github, context, core }) => {
  const { parseOrgSelections } = require('../utils/common.js');
  
  const commentBody = context.payload.comment.body;
  
  if (!commentBody.includes('📤 Source Organization') || 
      !commentBody.includes('📥 Target Organization')) {
    core.setOutput('is_org_comment', 'false');
    return;
  }
  
  core.setOutput('is_org_comment', 'true');
  
  const selections = parseOrgSelections(commentBody);
  const isValid = selections.sourceChecked === 1 && selections.targetChecked === 1;
  
  core.setOutput('is_valid', isValid.toString());
  
  if (!isValid) {
    if (selections.sourceChecked === 0 || selections.targetChecked === 0) {
      core.setOutput('error_type', 'none_selected');
    } else {
      core.setOutput('error_type', 'multiple_selected');
    }
    return;
  }
  
  // Extract hostnames from comment
  const sourceHostnameMatch = commentBody.match(/📤[\s\S]*?\(`([^`]+)`\)/);
  const targetHostnameMatch = commentBody.split('📥')[1]?.match(/\(`([^`]+)`\)/);
  
  core.setOutput('source_instance', selections.sourceInstance);
  core.setOutput('source_org', selections.sourceOrg);
  core.setOutput('source_hostname', sourceHostnameMatch?.[1] || 'unknown');
  core.setOutput('target_instance', selections.targetInstance);
  core.setOutput('target_org', selections.targetOrg);
  core.setOutput('target_hostname', targetHostnameMatch?.[1] || 'unknown');
  
  console.log('✅ Valid selection');
};