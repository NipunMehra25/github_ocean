const GITHUB_API_VERSION = "2022-11-28";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "github-ocean",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function fetchGithubJson(url, headers) {
  const response = await fetch(url, { headers });
  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Invalid JSON response from GitHub." };
  }

  if (!response.ok) {
    const error = new Error(data?.message || String(response.status));
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const headers = githubHeaders();
  if (!headers) {
    return res.status(500).json({
      error: "Missing GITHUB_TOKEN environment variable on the server.",
    });
  }

  const usernameRaw = Array.isArray(req.query.username) ? req.query.username[0] : req.query.username;
  const username = String(usernameRaw || "").trim();

  if (!username) {
    return res.status(400).json({ error: "Missing username query parameter." });
  }

  const userUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const commitsUrl = `https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}`;

  try {
    const user = await fetchGithubJson(userUrl, headers);

    let commitCount = 0;
    let note = "";

    try {
      const commits = await fetchGithubJson(commitsUrl, headers);
      commitCount = Number.isFinite(commits?.total_count) ? commits.total_count : 0;
      if (commitCount >= 1000) {
        note = "Commit count may be truncated by GitHub search indexing.";
      }
    } catch (error) {
      note = error?.status === 403
        ? "Commit count unavailable due to GitHub API limits."
        : "Commit count unavailable.";
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).json({
      displayName: user.name || username,
      username: user.login || username,
      publicRepos: user.public_repos ?? 0,
      commitCount,
      note,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const githubMessage = error?.body?.message;

    if (status === 404) {
      return res.status(404).json({ error: "Username not found on GitHub." });
    }

    if (status === 403) {
      return res.status(503).json({
        error: "GitHub API quota exhausted on the server. Try again later.",
        detail: githubMessage || "",
      });
    }

    return res.status(500).json({
      error: "Failed to fetch GitHub profile on the server.",
      detail: githubMessage || error?.message || "",
    });
  }
}
