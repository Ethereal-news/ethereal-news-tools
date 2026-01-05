#!/usr/bin/env node

/**
 * Ethereum Dev Tools Release Checker
 * 
 * Checks GitHub for the latest releases of Ethereum development tools.
 * Provides release dates.
 */

require('dotenv').config();
const https = require('https');

// Get GitHub token from environment (trim whitespace and check if not empty)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() || null;

// Dev tools repositories (sorted alphabetically by owner, then repo)
const DEV_TOOLS = [
    { name: 'Halmos', owner: 'a16z', repo: 'halmos' },
    { name: 'Ape', owner: 'ApeWorX', repo: 'ape' },
    { name: 'Solidity', owner: 'argotorg', repo: 'solidity' },
    { name: 'Sourcify', owner: 'argotorg', repo: 'sourcify' },
    { name: 'Revm', owner: 'bluealloy', repo: 'revm' },
    { name: 'EVMole', owner: 'cdump', repo: 'evmole' },
    { name: 'Echidna', owner: 'crytic', repo: 'echidna' },
    { name: 'Slither', owner: 'crytic', repo: 'slither' },
    { name: 'solc-select', owner: 'crytic', repo: 'solc-select' },
    { name: 'Foundry DevOps', owner: 'Cyfrin', repo: 'foundry-devops' },
    { name: 'Headlong', owner: 'esaulpaugh', repo: 'headlong' },
    { name: 'Ethers.js', owner: 'ethers-io', repo: 'ethers.js' },
    { name: 'EthereumJS Monorepo', owner: 'ethereumjs', repo: 'ethereumjs-monorepo' },
    { name: 'EthereumJS VM', owner: 'ethereumjs', repo: 'ethereumjs-vm' },
    { name: 'Voltaire', owner: 'evmts', repo: 'voltaire' },
    { name: 'Forge Std', owner: 'foundry-rs', repo: 'forge-std' },
    { name: 'Foundry', owner: 'foundry-rs', repo: 'foundry' },
    { name: 'Solidity Bytes Utils', owner: 'GNSPS', repo: 'solidity-bytes-utils' },
    { name: 'TrueBlocks Core', owner: 'Great-Hill-Corporation', repo: 'trueblocks-core' },
    { name: 'Circom', owner: 'iden3', repo: 'circom' },
    { name: 'Gas Cost Estimator', owner: 'imapp-pl', repo: 'gas-cost-estimator' },
    { name: 'Heimdall', owner: 'Jon-Becker', repo: 'heimdall-rs' },
    { name: 'TS Essentials', owner: 'krzkaczor', repo: 'ts-essentials' },
    { name: 'Nethereum', owner: 'Nethereum', repo: 'Nethereum' },
    { name: 'Hardhat', owner: 'NomicFoundation', repo: 'hardhat' },
    { name: 'Mythril', owner: 'ConsenSysDiligence', repo: 'mythril' },          // Added
    { name: 'Solady', owner: 'Vectorized', repo: 'solady' },                   // Added
    { name: 'OpenZeppelin Contracts', owner: 'OpenZeppelin', repo: 'openzeppelin-contracts' },
    { name: 'Otterscan', owner: 'otterscan', repo: 'otterscan' },
    { name: 'micro-eth-signer', owner: 'paulmillr', repo: 'micro-eth-signer' },
    { name: 'noble-ciphers', owner: 'paulmillr', repo: 'noble-ciphers' },
    { name: 'Snekmate', owner: 'pcaversaccio', repo: 'snekmate' },
    { name: 'xdeployer', owner: 'pcaversaccio', repo: 'xdeployer' },
    { name: 'VSCode Solidity Inspector', owner: 'PraneshASP', repo: 'vscode-solidity-inspector' },
    { name: 'Prettier Solidity', owner: 'prettier-solidity', repo: 'prettier-plugin-solidity' },
    { name: 'Solhint', owner: 'protofire', repo: 'solhint' },
    { name: 'Semaphore', owner: 'semaphore-protocol', repo: 'semaphore' },
    { name: 'BLST', owner: 'supranational', repo: 'blst' },
    { name: 'Slither (Trail of Bits)', owner: 'trailofbits', repo: 'slither' },
    { name: 'TrueBlocks Core (TrueBlocks)', owner: 'TrueBlocks', repo: 'trueblocks-core' },
    { name: 'ZeroKit', owner: 'vacp2p', repo: 'zerokit' },
    { name: 'Vyper', owner: 'vyperlang', repo: 'vyper' },
    { name: 'Viem', owner: 'wagmi-dev', repo: 'viem' },
    { name: 'Wagmi', owner: 'wagmi-dev', repo: 'wagmi' }
  ];

/**
 * Fetch data from GitHub API with redirect support
 * If authentication fails, retries without token
 */
async function fetchGitHubAPI(url, redirectCount = 0, useToken = true) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }

    const headers = {
      'User-Agent': 'Ethereum-DevTools-Release-Checker',
      'Accept': 'application/vnd.github.v3+json'
    };

    // Add GitHub token if available and useToken is true
    // Classic tokens (ghp_*) use "token" format
    // Fine-grained tokens (github_pat_*) use "Bearer" format
    if (useToken && GITHUB_TOKEN && GITHUB_TOKEN.length > 0) {
      if (GITHUB_TOKEN.startsWith('github_pat_')) {
        headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
      } else {
        // Classic tokens and others use "token" format
        headers['Authorization'] = `token ${GITHUB_TOKEN}`;
      }
    }

    const options = {
      headers: headers,
      followRedirect: false
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const location = res.headers.location;
          if (location) {
            // Follow redirect
            return fetchGitHubAPI(location, redirectCount + 1, useToken).then(resolve).catch(reject);
          }
        }

        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else if (res.statusCode === 404) {
          resolve(null); // Repository or release not found
        } else if (res.statusCode === 401) {
          // If we used a token and got 401, try again without token
          if (useToken && GITHUB_TOKEN) {
            console.warn(`  ⚠️  Authentication failed, retrying without token...`);
            return fetchGitHubAPI(url, redirectCount, false).then(resolve).catch(reject);
          }
          reject(new Error('GitHub API authentication failed. Please check your GITHUB_TOKEN in .env file or remove it to use unauthenticated requests.'));
        } else if (res.statusCode === 403) {
          reject(new Error('GitHub API rate limit exceeded. Please wait or use a valid GitHub token.'));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get latest release for a repository
 */
async function getLatestRelease(tool) {
  const url = `https://api.github.com/repos/${tool.owner}/${tool.repo}/releases/latest`;
  
  try {
    const release = await fetchGitHubAPI(url);
    if (!release) {
      return null;
    }

    return {
      name: tool.name,
      version: release.tag_name,
      publishedAt: new Date(release.published_at),
      url: release.html_url,
      prerelease: release.prerelease
    };
  } catch (error) {
    console.error(`Error fetching release for ${tool.name}: ${error.message}`);
    return null;
  }
}

/**
 * Format date as relative time
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

/**
 * Format release information
 */
function formatRelease(release) {
  if (!release) {
    return null;
  }

  const dateStr = release.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const relativeDate = formatDate(release.publishedAt);

  return {
    name: release.name,
    version: release.version,
    date: dateStr,
    relativeDate: relativeDate,
    publishedAt: release.publishedAt,
    url: release.url,
    prerelease: release.prerelease
  };
}

/**
 * Check if release is within the last 7 days
 */
function isWithinLast7Days(release) {
  if (!release || !release.publishedAt) {
    return false;
  }
  const now = new Date();
  const diffMs = now - release.publishedAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Checking for latest Ethereum dev tools releases...\n');
  console.log('=' .repeat(70));

  const results = [];

  // Fetch all dev tools
  console.log('\n🛠️  Development Tools:\n');
  for (const tool of DEV_TOOLS) {
    process.stdout.write(`  Checking ${tool.name}... `);
    const release = await getLatestRelease(tool);
    const formatted = formatRelease(release);
    
    if (formatted) {
      results.push(formatted);
      console.log(`✓ Found ${formatted.version} (${formatted.date})`);
    } else {
      console.log('✗ No release found');
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Filter releases to only show those from the last 7 days
  const recentReleases = results.filter(isWithinLast7Days);

  // Print summary
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📊 RELEASE SUMMARY (Last 7 Days)\n');
  console.log('='.repeat(70));

  if (recentReleases.length > 0) {
    recentReleases
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(release => {
        console.log(`\n${release.name} ${release.version}${release.prerelease ? ' (Pre-release)' : ''}`);
        console.log(`  Released: ${release.date} (${release.relativeDate})`);
        console.log(`  URL: ${release.url}`);
      });
  } else {
    console.log('\n  No releases in the last 7 days');
  }

  // Summary statistics
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📈 STATISTICS\n');
  console.log(`  Total Tools Checked: ${DEV_TOOLS.length}`);
  console.log(`  Releases Found: ${results.length}`);
  console.log(`  Releases in Last 7 Days: ${recentReleases.length}\n`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { getLatestRelease, formatRelease, DEV_TOOLS };

