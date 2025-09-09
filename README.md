# GitHub Enterprise Migration System

A comprehensive GitHub Actions-based solution for migrating repositories from GitHub Enterprise Server (GHES) or GitHub Enterprise Cloud (GHEC) to GitHub Enterprise Cloud using GitHub Enterprise Importer (GEI).

## Overview

This migration system provides an automated, issue-driven workflow for migrating repositories at scale. It supports:

- **Batch Processing**: Automatically splits large migrations into manageable batches (default: 250 repos per batch)
- **Migration Types**: Both dry-run (non-destructive) and production (with source locking) migrations
- **Additional Data**: Automated migration of LFS data, packages, and releases
- **Visibility Options**: Private, Internal, or Mirror (preserves source visibility)
- **Progress Tracking**: Real-time updates via issue comments

## Prerequisites

### Required Tools
- GitHub Enterprise Importer (GEI) CLI
- PowerShell Core (pwsh)
- Node.js (for supporting scripts)
- Git

### Required Access
- Source GitHub instance (GHES or GHEC) with admin access
- Target GitHub Enterprise Cloud organization with admin access
- Personal Access Tokens (PATs) with appropriate permissions

### Runner Requirements
- Self-hosted runners recommended for large migrations
- Ubuntu-based runners (or compatible Linux distribution)
- Sufficient disk space for migration archives

## Setup Instructions

### 1. Repository Setup

1. Clone this repository to your target GitHub organization:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Ensure the following directory structure exists:
```
.github/
├── ISSUE_TEMPLATE/
│   ├── config.yml
│   └── github-repos-migration-gei-batch.yml
├── scripts/
│   └── check-csv-repo.cjs
└── workflows/
    ├── migration-batch-processor.yml
    ├── migration-github-repos-gei-batched.yml
    ├── migration-lfs.yml
    ├── migration-packages.yml
    ├── migration-prepare-batched.yml
    ├── migration-releases.yml
    └── shared-github-enterprise-cloud-gei-batched.yml
```

### 2. Configure Secrets

Navigate to **Settings > Secrets and variables > Actions** in your repository and add:

#### Required Secrets
- `TARGET_ADMIN_TOKEN`: PAT for target GitHub Enterprise Cloud organization
  - Required scopes: `repo`, `admin:org`, `workflow`
- `SOURCE_ADMIN_TOKEN`: PAT for source GitHub instance
  - Required scopes: `repo`, `admin:org`

#### Optional Storage Secrets (choose one)
For Azure Blob Storage:
- `AZURE_STORAGE_CONNECTION_STRING`: Connection string for Azure storage account

For AWS S3:
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

### 3. Configure Variables

Navigate to **Settings > Secrets and variables > Actions > Variables** and add:

#### Required Variables
- `TARGET_ORGANIZATION`: Name of the target GitHub Enterprise Cloud organization
- `INSTALL_PREREQS`: Set to `true` to auto-install dependencies (recommended)

#### Optional Variables (for AWS S3)
- `AWS_REGION`: AWS region for S3 bucket (e.g., `us-east-1`)
- `AWS_BUCKET_NAME`: Name of the S3 bucket

#### Optional Variables (for additional migrations)
- `SOURCE_ORGANIZATION`: Source organization name (for releases migration)

### 4. Prepare Supporting Files (Optional)

If you have repositories with special requirements, create these CSV files in the repository root:

**lfs.csv** - List repositories requiring LFS migration:
```csv
repository
https://github.example.com/org/repo1
https://github.example.com/org/repo2
```

**packages.csv** - List repositories with packages to migrate:
```csv
repository
https://github.example.com/org/repo1
https://github.example.com/org/repo3
```

**user-mappings-gei.csv** - Map source users to target users:
```csv
source,target
source-username1,target-username1
source-username2,target-username2
```

### 5. Configure Runners (Optional)

For large migrations, configure self-hosted runners:

1. Add self-hosted runners to your repository or organization
2. Update the `RUNNER` value in workflows from `ubuntu-latest` to your runner labels
3. Ensure runners have:
   - Internet access
   - Sufficient disk space
   - Required tools installed (or set `INSTALL_PREREQS=true`)

## Usage

### Step 1: Create Migration Issue

1. Navigate to **Issues > New Issue**
2. Select **"GHES/GHEC repos to GitHub migration [GEI]"** template
3. Fill in the required information:
   - **Repositories**: List of repository URLs (one per line)
   - **Target repository visibility**: Choose Private, Internal, or Mirror

Example repository list:
```
https://github.example.com/org/repository1
https://github.example.com/org/repository2
https://github.example.com/org/repository3
```

For large lists, use the collapsible details section:
```markdown
<details>
<summary>Click to expand repository list</summary>

https://github.example.com/org/repo1
https://github.example.com/org/repo2
<!-- ... more repositories ... -->

</details>
```

### Step 2: Review Preparation

After creating the issue, the system will:
1. Parse your repository list
2. Post a comment confirming:
   - Number of repositories detected
   - Target organization
   - Target visibility setting
   - Batch information (if >200 repositories)

### Step 3: Run Migration

Add a comment to the issue with one of these commands:

#### Dry-Run Migration (Recommended First)
```
/run-dry-run-migration
```
- Does NOT lock source repositories
- Creates test repositories with `-dry-run-<timestamp>` suffix
- Allows verification before production migration

#### Production Migration
```
/run-production-migration
```
- LOCKS source repositories during migration
- Creates repositories with original names
- Should be run after successful dry-run

### Step 4: Monitor Progress

The system will provide updates via issue comments:
- Batch start/completion notifications
- Success/failure status for each batch
- Links to detailed workflow runs
- Final summary report

### Step 5: Post-Migration Actions

#### After Dry-Run
- Review migrated repositories
- Check for any issues or missing data
- Delete test repositories if needed: `/delete-repositories`
- Proceed with production migration

#### After Production
- Verify all repositories migrated successfully
- Check LFS, packages, and releases if applicable
- Update team access and permissions
- Update CI/CD configurations
- Notify users of completion

## Advanced Configuration

### Batch Size Adjustment

Modify `BATCH_SIZE` in `migration-github-repos-gei-batched.yml`:
```yaml
BATCH_SIZE: 250  # Adjust based on your needs
```

Considerations:
- Smaller batches (50-100): More reliable, slower overall
- Larger batches (500+): Faster but may hit API limits

### Timeout Configuration

For very large repositories, adjust timeouts in `migration-batch-processor.yml`:
```yaml
timeout-minutes: 50400  # Current: 35 days
```

### Parallel Processing

Modify `max-parallel` in `migration-batch-processor.yml`:
```yaml
max-parallel: 10  # Number of concurrent repository migrations per batch
```

### Custom Visibility Mapping

For Mirror mode, the system can preserve source visibility. Modify the visibility logic in `migration-batch-processor.yml` if you need custom mapping rules.

## Troubleshooting

### Common Issues

#### 1. Migration Fails to Start
- Verify PAT permissions
- Check secret configuration
- Ensure issue labels are correct (`migration`, `batch`)

#### 2. Batch Processing Stops
- Check workflow logs for specific errors
- Verify runner availability
- Check API rate limits

#### 3. Missing Data After Migration
- Ensure LFS/packages CSVs are properly formatted
- Verify source repository has the expected data
- Check supplementary workflow logs

#### 4. Authentication Errors
```
Error: HttpError: Bad credentials
```
- Regenerate and update PATs
- Verify token scopes
- Check token expiration

### Canceling a Migration

To cancel an in-progress migration, add a comment:
```
/cancel-migration
```

This will:
- Stop processing new batches
- Cancel queued workflows
- Allow running migrations to complete

### Re-running Failed Batches

1. Identify failed batch from issue comments
2. Navigate to Actions tab
3. Find the failed `migration-batch-processor` run
4. Click "Re-run failed jobs"

### Manual Batch Execution

For specific batch re-runs:
1. Go to Actions > migration-batch-processor
2. Click "Run workflow"
3. Provide batch configuration from logs

## Monitoring and Logs

### Key Locations
- **Issue Comments**: High-level progress updates
- **Actions Tab**: Detailed workflow logs
- **Workflow Run Summaries**: Batch-specific results

### Log Retention
- GitHub Actions logs: 90 days (default)
- Migration artifacts: Based on your storage configuration
- Issue history: Permanent record of migration

## Security Considerations

1. **Token Security**
   - Use repository secrets, never hardcode tokens
   - Rotate tokens after migration
   - Use minimum required permissions

2. **Access Control**
   - Restrict who can create migration issues
   - Limit repository access during migration
   - Review team permissions post-migration

3. **Data Handling**
   - Migration data temporarily stored in configured storage
   - Clean up storage after successful migration
   - Consider encryption for sensitive repositories

## Support and Contribution

### Getting Help
1. Check workflow logs for detailed error messages
2. Review GitHub Enterprise Importer documentation
3. Open an issue in this repository with:
   - Error messages
   - Workflow run links
   - Configuration details (excluding secrets)

### Contributing
- Test changes thoroughly with dry-run migrations
- Update documentation for new features
- Follow existing code patterns and structure

## License

[Specify your license here]

---

**Note**: This migration system is designed for GitHub Enterprise migrations. Always perform dry-run migrations first and ensure you have backups of critical data before running production migrations.
