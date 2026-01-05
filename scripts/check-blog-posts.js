#!/usr/bin/env node

/**
 * Ethereum Blog Posts Checker
 * 
 * Checks RSS feeds for the latest blog posts from Ethereum-related sources.
 * Shows posts from the last 7 days.
 */

require('dotenv').config();
const https = require('https');
const { parseString } = require('xml2js');

// RSS feeds to check
const RSS_FEEDS = [
  { name: 'Ethereum Foundation Blog', url: 'https://blog.ethereum.org/en/feed.xml' },
];

/**
 * Fetch RSS feed data
 */
async function fetchRSSFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          parseString(data, (err, result) => {
            if (err) {
              reject(new Error(`Failed to parse RSS feed: ${err.message}`));
            } else {
              resolve(result);
            }
          });
        } else {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse RSS feed and extract posts
 */
function parseRSSFeed(feedData, feedName) {
  const posts = [];
  
  if (!feedData.rss || !feedData.rss.channel || !feedData.rss.channel[0] || !feedData.rss.channel[0].item) {
    return posts;
  }

  const items = feedData.rss.channel[0].item;
  
  for (const item of items) {
    const title = item.title && item.title[0] ? item.title[0] : 'Untitled';
    const link = item.link && item.link[0] ? item.link[0] : '';
    const pubDate = item.pubDate && item.pubDate[0] ? new Date(item.pubDate[0]) : null;
    const description = item.description && item.description[0] ? item.description[0] : '';
    const categories = item.category ? item.category.map(cat => (typeof cat === 'string' ? cat : cat._ || cat)) : [];

    if (pubDate) {
      posts.push({
        feed: feedName,
        title: title,
        link: link,
        publishedAt: pubDate,
        description: description,
        categories: categories
      });
    }
  }

  return posts;
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
 * Format post information
 */
function formatPost(post) {
  const dateStr = post.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const relativeDate = formatDate(post.publishedAt);

  // Clean description (remove HTML tags and CDATA)
  let cleanDescription = post.description
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
  
  // Limit description length
  if (cleanDescription.length > 200) {
    cleanDescription = cleanDescription.substring(0, 197) + '...';
  }

  return {
    feed: post.feed,
    title: post.title,
    link: post.link,
    date: dateStr,
    relativeDate: relativeDate,
    publishedAt: post.publishedAt,
    description: cleanDescription,
    categories: post.categories
  };
}

/**
 * Check if post is within the last 7 days
 */
function isWithinLast7Days(post) {
  if (!post || !post.publishedAt) {
    return false;
  }
  const now = new Date();
  const diffMs = now - post.publishedAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Checking for latest Ethereum blog posts...\n');
  console.log('=' .repeat(70));

  const allPosts = [];

  // Fetch all RSS feeds
  console.log('\n📰 Checking RSS Feeds:\n');
  for (const feed of RSS_FEEDS) {
    process.stdout.write(`  Checking ${feed.name}... `);
    try {
      const feedData = await fetchRSSFeed(feed.url);
      const posts = parseRSSFeed(feedData, feed.name);
      allPosts.push(...posts);
      console.log(`✓ Found ${posts.length} posts`);
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Filter posts to only show those from the last 7 days
  const recentPosts = allPosts.filter(isWithinLast7Days);

  // Print summary
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📊 BLOG POSTS SUMMARY (Last 7 Days)\n');
  console.log('='.repeat(70));

  if (recentPosts.length > 0) {
    // Sort alphabetically by title
    recentPosts
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(post => {
        const formatted = formatPost(post);
        console.log(`\n${formatted.title}`);
        console.log(`  Feed: ${formatted.feed}`);
        console.log(`  Published: ${formatted.date} (${formatted.relativeDate})`);
        if (formatted.categories.length > 0) {
          console.log(`  Categories: ${formatted.categories.join(', ')}`);
        }
        if (formatted.description) {
          console.log(`  Description: ${formatted.description}`);
        }
        console.log(`  URL: ${formatted.link}`);
      });
  } else {
    console.log('\n  No posts in the last 7 days');
  }

  // Summary statistics
  console.log('\n\n' + '='.repeat(70));
  console.log('\n📈 STATISTICS\n');
  console.log(`  Total Feeds Checked: ${RSS_FEEDS.length}`);
  console.log(`  Total Posts Found: ${allPosts.length}`);
  console.log(`  Posts in Last 7 Days: ${recentPosts.length}\n`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { fetchRSSFeed, parseRSSFeed, formatPost, RSS_FEEDS };

