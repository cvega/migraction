const fs = require('fs');

try {
  const config = JSON.parse(fs.readFileSync('.github/config/instances.json', 'utf8'));
  
  console.log('✓ Configuration file is valid JSON');
  
  // Check structure
  if (!config.sources || !config.targets) {
    throw new Error('Missing sources or targets');
  }
  
  console.log(`✓ Sources: ${Object.keys(config.sources).length}`);
  console.log(`✓ Targets: ${Object.keys(config.targets).length}`);
  
  // Validate each source
  for (const [instanceName, instanceConfig] of Object.entries(config.sources)) {
    if (!instanceConfig.hostname) {
      throw new Error(`Source ${instanceName} missing hostname`);
    }
    if (!instanceConfig.tokenSecret) {
      throw new Error(`Source ${instanceName} missing tokenSecret`);
    }
    if (!instanceConfig.orgs || Object.keys(instanceConfig.orgs).length === 0) {
      throw new Error(`Source ${instanceName} has no orgs`);
    }
    
    console.log(`  ✓ ${instanceName}: ${Object.keys(instanceConfig.orgs).length} orgs`);
  }
  
  // Validate each target
  for (const [instanceName, instanceConfig] of Object.entries(config.targets)) {
    if (!instanceConfig.hostname) {
      throw new Error(`Target ${instanceName} missing hostname`);
    }
    if (!instanceConfig.tokenSecret) {
      throw new Error(`Target ${instanceName} missing tokenSecret`);
    }
    if (!instanceConfig.orgs || Object.keys(instanceConfig.orgs).length === 0) {
      throw new Error(`Target ${instanceName} has no orgs`);
    }
    
    console.log(`  ✓ ${instanceName}: ${Object.keys(instanceConfig.orgs).length} orgs`);
  }
  
  console.log('\n✅ Configuration is valid!');
  
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}