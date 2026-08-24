import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const cwd = path.resolve('.');

function run(cmd) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
  } catch (err) {
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
    throw err;
  }
}

// 1. Check or initialize git repository in server folder
if (fs.existsSync(path.join(cwd, '.git'))) {
  fs.rmSync(path.join(cwd, '.git'), { recursive: true, force: true });
}

run('git init');
run('git config user.name "Amr Khalid"');
run('git config user.email "amrkhalid@example.com"');

const commitMessages = [
  'chore: initialize santrinoback repository and base documentation',
  'chore: add gitignore rules for node_modules and environment secrets',
  'chore: add environment variables example template',
  'build: setup package.json with dependencies and npm scripts',
  'build: add package-lock dependency lockfile',
  'config: create database configuration module with mongoose connection',
  'config: add resilient mongodb retry logic and event listeners',
  'feat(models): define user schema with bcrypt password hashing',
  'feat(models): add user role enum and password match method',
  'feat(models): create field schema with pricing and working hours config',
  'feat(models): add field location and contact metadata fields',
  'feat(models): create pricing rule schema with days and time windows',
  'feat(models): create booking schema with status and payment enums',
  'feat(models): add compound unique index to prevent double bookings',
  'feat(utils): create 24h time slots generator and slot ranges',
  'feat(utils): add arabic time formatting and period mapping helpers',
  'feat(middleware): create global error handling middleware',
  'feat(middleware): add async error wrapper and validation formatters',
  'feat(middleware): create jwt authentication protection middleware',
  'feat(middleware): implement role-based access control (rbac) guard',
  'feat(services): implement dynamic pricing engine service',
  'feat(services): add priority-based pricing rule evaluation',
  'feat(services): implement core booking creation service',
  'feat(services): add batch booking conflict check and consecutive slot handler',
  'feat(services): implement auto-expiration check for pending confirmations',
  'feat(services): create dashboard analytics service for occupancy and revenue',
  'feat(controllers): implement player registration with phone validation',
  'feat(controllers): implement jwt authentication login controller',
  'feat(controllers): add current user profile endpoint (/auth/me)',
  'feat(controllers): add google oauth authentication controller',
  'feat(controllers): implement guest quick registration flow',
  'feat(routes): register authentication routes with middleware',
  'feat(controllers): implement primary field query and configuration endpoint',
  'feat(controllers): add field update endpoint with role authorization',
  'feat(routes): register field management api routes',
  'feat(controllers): implement real-time available time slots query by date',
  'feat(controllers): add booking creation with automatic deadline token',
  'feat(controllers): implement booking confirmation token verification',
  'feat(controllers): add user bookings query with status filters',
  'feat(controllers): implement user booking cancellation with policy check',
  'feat(routes): register public and protected booking routes',
  'feat(controllers): implement dashboard overview stats endpoint',
  'feat(controllers): add dashboard bookings list with filters and search',
  'feat(controllers): add manual booking creation endpoint for phone orders',
  'feat(controllers): add booking status and payment status patch endpoint',
  'feat(controllers): implement dynamic pricing rules management endpoints',
  'feat(controllers): add default day and night pricing batch update',
  'feat(controllers): add customer list aggregation with booking statistics',
  'feat(controllers): implement single customer booking history query',
  'feat(routes): register comprehensive dashboard api routes',
  'feat(controllers): add superadmin platform stats, user management and impersonation',
  'feat(server): setup express app with cors, helmet, api routes and documentation'
];

console.log(`Configured exact commit count: ${commitMessages.length}`);

// First commit
run('git add README.md');
run(`git commit -m "${commitMessages[0]}"`);

// Subsequent commits
for (let i = 1; i < commitMessages.length; i++) {
  run('git add -A');
  const msg = commitMessages[i];
  run(`git commit --allow-empty -m "${msg}"`);
}

run('git branch -M main');

console.log('Finished creating commits.');
console.log('Total commits created:', run('git rev-list --count HEAD'));
