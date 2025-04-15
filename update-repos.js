const axios = require('axios');
const fs = require('fs').promises;

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const API_BASE_URL = 'https://api.github.com';
const API_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
};

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1000; // 1 second delay between requests
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRateLimit(url) {
  try {
    const response = await axios.get(url, { headers: API_HEADERS });
    await sleep(RATE_LIMIT_DELAY);
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error(`Rate limit exceeded for ${url}. Please check your GitHub token or wait before trying again.`);
    } else {
      console.error(`Error fetching ${url}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Fetch MCP repositories from GitHub
 */
async function fetchMCPRepositories() {
  console.log('Fetching MCP repositories from GitHub...');
  
  const query = 'topic:mcp';
  const url = `${API_BASE_URL}/search/repositories?q=${query}&sort=stars&order=desc&per_page=100`;
  
  try {
    const response = await axios.get(url, { headers: API_HEADERS });
    const repos = response.data.items;
    const totalCount = response.data.total_count;
    console.log(`Found ${repos.length} MCP repositories (total: ${totalCount})`);
    return { repos, totalCount };
  } catch (error) {
    console.error('Error fetching repositories:', error.message);
    return { repos: [], totalCount: 0 };
  }
}

/**
 * Generate markdown table from repositories
 */
function generateMarkdownTable(repos) {
  const header = '| Repository | Description | Stars | Author |\n|------------|-------------|-------|--------|\n';
  
  const rows = repos.map(repo => {
    const authorInfo = repo.owner.type === 'Organization' 
      ? `[@${repo.owner.login}](${repo.owner.html_url}) (${repo.owner.login})`
      : `[@${repo.owner.login}](${repo.owner.html_url})`;
    
    // Escape pipe characters in description
    const description = (repo.description || '').replace(/\|/g, '\\|');
    
    return `| [${repo.name}](${repo.html_url}) | ${description} | ${repo.stargazers_count} | ${authorInfo} |`;
  }).join('\n');
  
  return header + rows;
}

/**
 * Main function to fetch and update README
 */
async function updateREADME() {
  try {
    const { repos, totalCount } = await fetchMCPRepositories();
    if (repos.length === 0) {
      console.error('No repositories found to update README');
      return;
    }
    
    const table = generateMarkdownTable(repos);
    const readmeContent = `# Awesome MCP

A curated list of awesome Model Context Protocol (MCP) repositories. Currently tracking ${totalCount} repositories. This list is automatically updated every hour.

${table}

## Contributing

Please feel free to contribute to this list by submitting a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
`;
    
    await fs.writeFile('README.md', readmeContent);
    console.log('README.md has been updated successfully!');
  } catch (error) {
    console.error('Error updating README:', error.message);
  }
}

// Check for GitHub token
if (!GITHUB_TOKEN) {
  console.warn('Warning: GITHUB_TOKEN environment variable is not set. This may result in rate limiting issues.');
  console.warn('Please set your GitHub token using: export GITHUB_TOKEN=your_token_here');
}

updateREADME(); 