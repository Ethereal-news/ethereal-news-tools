#!/usr/bin/env node

/**
 * Ethereum Client Release Checker
 * 
 * Checks GitHub for the latest releases of Ethereum execution and consensus layer clients.
 * Provides release dates.
 */

require('dotenv').config();
const https = require('https');

// Get GitHub token from environment (trim whitespace and check if not empty)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() || null;

// Ethereum client repositories
const CLIENTS = {
  execution: [
    { name: 'Geth', owner: 'ethereum', repo: 'go-ethereum' },
    { name: 'Erigon', owner: 'ledgerwatch', repo: 'erigon' },
    { name: 'Nethermind', owner: 'NethermindEth', repo: 'nethermind' },
    { name: 'Besu', owner: 'hyperledger', repo: 'besu' },
    { name: 'Reth', owner: 'paradigmxyz', repo: 'reth' },
  ],
  consensus: [
    { name: 'Prysm', owner: 'prysmaticlabs', repo: 'prysm' },
    { name: 'Lighthouse', owner: 'sigp', repo: 'lighthouse' },
    { name: 'Teku', owner: 'ConsenSys', repo: 'teku' },
    { name: 'Nimbus', owner: 'status-im', repo: 'nimbus-eth2' },
    { name: 'Lodestar', owner: 'ChainSafe', repo: 'lodestar' },
    { name: 'Grandine', owner: 'grandinetech', repo: 'grandine' },
  ]
};

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
      'User-Agent': 'Ethereum-Release-Checker',
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
async function getLatestRelease(client) {
  const url = `https://api.github.com/repos/${client.owner}/${client.repo}/releases/latest`;
  
  try {
    const release = await fetchGitHubAPI(url);
    if (!release) {
      return null;
    }

    return {
      name: client.name,
      version: release.tag_name,
      publishedAt: new Date(release.published_at),
      url: release.html_url,
      prerelease: release.prerelease
    };
  } catch (error) {
    console.error(`Error fetching release for ${client.name}: ${error.message}`);
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
  console.log('🔍 Checking for latest Ethereum client releases...\n');
  console.log('=' .repeat(70));

  const results = {
    execution: [],
    consensus: []
  };

  // Fetch execution layer clients
  console.log('\n📦 Execution Layer Clients:\n');
  for (const client of CLIENTS.execution) {
    process.stdout.write(`  Checking ${client.name}... `);
    const release = await getLatestRelease(client);
    const formatted = formatRelease(release);
    
    if (formatted) {
      results.execution.push(formatted);
      console.log(`✓ Found ${formatted.version} (${formatted.date})`);
    } else {
      console.log('✗ No release found');
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Fetch consensus layer clients
  console.log('\n\n🔐 Consensus Layer Clients:\n');
  for (const client of CLIENTS.consensus) {
    process.stdout.write(`  Checking ${client.name}... `);
    const release = await getLatestRelease(client);
    const formatted = formatRelease(release);
    
    if (formatted) {
      results.consensus.push(formatted);
      console.log(`✓ Found ${formatted.version} (${formatted.date})`);
    } else {
      console.log('✗ No release found');
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Filter releases to only show those from the last 7 days
  const recentExecution = results.execution.filter(isWithinLast7Days);
  const recentConsensus = results.consensus.filter(isWithinLast7Days);

  // Print summary
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📊 RELEASE SUMMARY (Last 7 Days)\n');
  console.log('='.repeat(70));

  // Execution Layer Summary
  if (recentExecution.length > 0) {
    console.log('\n🚀 EXECUTION LAYER CLIENTS\n');
    recentExecution
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .forEach(release => {
        console.log(`\n${release.name} ${release.version}${release.prerelease ? ' (Pre-release)' : ''}`);
        console.log(`  Released: ${release.date} (${release.relativeDate})`);
        console.log(`  URL: ${release.url}`);
      });
  } else {
    console.log('\n🚀 EXECUTION LAYER CLIENTS\n');
    console.log('  No releases in the last 7 days');
  }

  // Consensus Layer Summary
  if (recentConsensus.length > 0) {
    console.log('\n\n🔐 CONSENSUS LAYER CLIENTS\n');
    recentConsensus
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .forEach(release => {
        console.log(`\n${release.name} ${release.version}${release.prerelease ? ' (Pre-release)' : ''}`);
        console.log(`  Released: ${release.date} (${release.relativeDate})`);
        console.log(`  URL: ${release.url}`);
      });
  } else {
    console.log('\n\n🔐 CONSENSUS LAYER CLIENTS\n');
    console.log('  No releases in the last 7 days');
  }

  // Summary statistics
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📈 STATISTICS\n');
  console.log(`  Execution Layer Clients: ${recentExecution.length} releases in last 7 days`);
  console.log(`  Consensus Layer Clients: ${recentConsensus.length} releases in last 7 days`);
  console.log(`  Total: ${recentExecution.length + recentConsensus.length} releases in last 7 days\n`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { getLatestRelease, formatRelease, CLIENTS };

