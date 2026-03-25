/**
 * Delete All Cloudflare Pages and Workers Script
 * @description This script deletes ALL Pages projects and Workers from your Cloudflare account
 * @warning USE WITH CAUTION - This operation cannot be undone!
 */

import { execSync } from 'child_process';

interface Resource {
  name: string;
  type: 'page' | 'worker';
}

class CloudflareCleaner {
  private readonly wranglerCommand = 'npx wrangler';
  private deletedResources: Resource[] = [];
  private failedResources: Array<{ resource: Resource; error: string }> = [];

  /**
   * List all Pages projects
   */
  private listPagesProjects(): string[] {
    try {
      const stdout = execSync(`${this.wranglerCommand} pages project list`, {
        encoding: 'utf-8',
      });

      const projects: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (line.includes('│')) {
          const parts = line.split('│').map((s) => s.trim());
          // Project name is usually in the second column
          if (parts.length >= 2 && parts[1] && parts[1] !== 'name') {
            projects.push(parts[1]);
          }
        }
      }

      return projects;
    } catch (error) {
      console.error('Error listing Pages projects:', error);
      return [];
    }
  }

  /**
   * List all Workers
   */
  private listWorkers(): string[] {
    try {
      const stdout = execSync(`${this.wranglerCommand} worker list`, {
        encoding: 'utf-8',
      });

      const workers: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (line.includes('│')) {
          const parts = line.split('│').map((s) => s.trim());
          // Worker name is usually in the second column
          if (parts.length >= 2 && parts[1] && parts[1] !== 'name') {
            workers.push(parts[1]);
          }
        }
      }

      return workers;
    } catch (error) {
      console.error('Error listing Workers:', error);
      return [];
    }
  }

  /**
   * Delete a Pages project
   */
  private deletePagesProject(projectName: string): boolean {
    try {
      console.log(`🗑️  Deleting Pages project: ${projectName}`);
      execSync(`${this.wranglerCommand} pages project delete ${projectName}`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      this.deletedResources.push({ name: projectName, type: 'page' });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to delete Pages project ${projectName}:`, errorMsg);
      this.failedResources.push({
        resource: { name: projectName, type: 'page' },
        error: errorMsg,
      });
      return false;
    }
  }

  /**
   * Delete a Worker
   */
  private deleteWorker(workerName: string): boolean {
    try {
      console.log(`🗑️  Deleting Worker: ${workerName}`);
      execSync(`${this.wranglerCommand} worker delete ${workerName}`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      this.deletedResources.push({ name: workerName, type: 'worker' });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to delete Worker ${workerName}:`, errorMsg);
      this.failedResources.push({
        resource: { name: workerName, type: 'worker' },
        error: errorMsg,
      });
      return false;
    }
  }

  /**
   * List all resources before deletion
   */
  listAll(): { pages: string[]; workers: string[] } {
    console.log('\n📋 Scanning Cloudflare account for resources...\n');

    const pages = this.listPagesProjects();
    const workers = this.listWorkers();

    console.log(`Found ${pages.length} Pages projects`);
    if (pages.length > 0) {
      pages.forEach((page) => console.log(`  - ${page}`));
    }

    console.log(`\nFound ${workers.length} Workers`);
    if (workers.length > 0) {
      workers.forEach((worker) => console.log(`  - ${worker}`));
    }

    return { pages, workers };
  }

  /**
   * Delete all resources
   */
  async deleteAll(options?: { confirm?: boolean }): Promise<void> {
    const { pages, workers } = this.listAll();

    if (pages.length === 0 && workers.length === 0) {
      console.log('\n✨ No resources to delete. Your account is already clean!');
      return;
    }

    // Ask for confirmation unless auto-confirmed
    if (!options?.confirm) {
      console.log('\n⚠️  WARNING: This will delete ALL Pages projects and Workers!');
      console.log('This operation cannot be undone.\n');

      // For Node.js scripts, you might want to use a different confirmation method
      // For now, we'll require explicit confirmation via the confirm parameter
      throw new Error('Please pass { confirm: true } to proceed with deletion');
    }

    console.log('\n🚀 Starting deletion process...\n');

    // Delete all Pages projects
    if (pages.length > 0) {
      console.log(`\n📄 Deleting ${pages.length} Pages projects...\n`);
      for (const project of pages) {
        this.deletePagesProject(project);
      }
    }

    // Delete all Workers
    if (workers.length > 0) {
      console.log(`\n⚙️  Deleting ${workers.length} Workers...\n`);
      for (const worker of workers) {
        this.deleteWorker(worker);
      }
    }

    // Print summary
    this.printSummary();
  }

  /**
   * Print deletion summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(60));

    if (this.deletedResources.length > 0) {
      console.log(`\n✅ Successfully deleted ${this.deletedResources.length} resources:`);

      const pages = this.deletedResources.filter((r) => r.type === 'page');
      const workers = this.deletedResources.filter((r) => r.type === 'worker');

      if (pages.length > 0) {
        console.log(`\n📄 Pages projects (${pages.length}):`);
        pages.forEach((p) => console.log(`  ✅ ${p.name}`));
      }

      if (workers.length > 0) {
        console.log(`\n⚙️  Workers (${workers.length}):`);
        workers.forEach((w) => console.log(`  ✅ ${w.name}`));
      }
    }

    if (this.failedResources.length > 0) {
      console.log(`\n❌ Failed to delete ${this.failedResources.length} resources:`);
      this.failedResources.forEach(({ resource, error }) => {
        console.log(`  ❌ ${resource.type}: ${resource.name}`);
        console.log(`     Error: ${error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// CLI execution
if (require.main === module) {
  const cleaner = new CloudflareCleaner();

  // First, list all resources
  const { pages, workers } = cleaner.listAll();

  if (pages.length === 0 && workers.length === 0) {
    console.log('\n✨ No resources to delete. Your account is already clean!');
    process.exit(0);
  }

  console.log('\n⚠️  WARNING: This will delete ALL Pages projects and Workers!');
  console.log('This operation cannot be undone.');
  console.log('\nTo proceed, run with: npx ts-node scripts/delete-all-cloudflare-resources.ts --confirm');
  console.log('Or programmatically call: cleaner.deleteAll({ confirm: true })');

  // Check for --confirm flag
  const args = process.argv.slice(2);
  if (args.includes('--confirm')) {
    cleaner.deleteAll({ confirm: true }).catch((error) => {
      console.error('Error during deletion:', error);
      process.exit(1);
    });
  }
}

export { CloudflareCleaner };
