module.exports = async ({ github, context, core }) => {
  const { parseOrgSelections } = require('../utils/common.js');
  
  const commentBody = context.payload.comment.body;
  const commentUser = context.payload.comment.user;
  
  console.log('=== VALIDATION START ===');
  console.log('Comment user:', commentUser.login);
  console.log('Comment user type:', commentUser.type);
  console.log('Comment length:', commentBody.length);
  
  // Skip bot comments
  if (commentUser.type === 'Bot' || commentUser.login.includes('[bot]')) {
    console.log('⏭️ Skipping bot comment');
    core.setOutput('is_org_comment', 'false');
    return;
  }
  
  console.log('Has 📤:', commentBody.includes('📤 Source Organization'));
  console.log('Has 📥:', commentBody.includes('📥 Target Organization'));
  
  if (!commentBody.includes('📤 Source Organization') || 
      !commentBody.includes('📥 Target Organization')) {
    console.log('❌ Not an org selection comment');
    core.setOutput('is_org_comment', 'false');
    return;
  }
  
  console.log('✅ Is org selection comment');
  core.setOutput('is_org_comment', 'true');
  
  const selections = parseOrgSelections(commentBody);
  
  console.log('Parsed selections:', JSON.stringify(selections, null, 2));
  console.log('Source checked:', selections.sourceChecked);
  console.log('Target checked:', selections.targetChecked);
  
  const isValid = selections.sourceChecked === 1 && selections.targetChecked === 1;
  
  console.log('Is valid?', isValid);
  core.setOutput('is_valid', isValid.toString());
  
  if (!isValid) {
    if (selections.sourceChecked === 0 || selections.targetChecked === 0) {
      console.log('❌ No selections made');
      core.setOutput('error_type', 'none_selected');
    } else {
      console.log('❌ Multiple selections made');
      core.setOutput('error_type', 'multiple_selected');
    }
    return;
  }
  
  // Extract hostnames from comment
  const sourceHostnameMatch = commentBody.match(/📤[\s\S]*?\(`([^`]+)`\)/);
  const targetHostnameMatch = commentBody.split('📥')[1]?.match(/\(`([^`]+)`\)/);
  
  console.log('Source hostname:', sourceHostnameMatch?.[1]);
  console.log('Target hostname:', targetHostnameMatch?.[1]);
  
  core.setOutput('source_instance', selections.sourceInstance);
  core.setOutput('source_org', selections.sourceOrg);
  core.setOutput('source_hostname', sourceHostnameMatch?.[1] || 'unknown');
  core.setOutput('target_instance', selections.targetInstance);
  core.setOutput('target_org', selections.targetOrg);
  core.setOutput('target_hostname', targetHostnameMatch?.[1] || 'unknown');
  
  console.log('✅ Valid selection - outputs set');
  console.log('=== VALIDATION END ===');
};