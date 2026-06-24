import { readEnvFile } from './env.js';
import { logger } from './logger.js';

// ── Config ──────────────────────────────────────────────────────────

const envConfig = readEnvFile(['XAI_API_KEY']);
const XAI_API_KEY = process.env.XAI_API_KEY || envConfig.XAI_API_KEY || '';

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const DEFAULT_MODEL = 'grok-3-fast';

// ── Types ───────────────────────────────────────────────────────────

export type SearchMode =
  | 'tech_leaders'
  | 'breaking_news'
  | 'multi_source'
  | 'historical'
  | 'memes_trends'
  | 'community_pulse';

export interface SearchOptions {
  /** Override the default X handles for tech_leaders mode */
  handles?: string[];
  /** ISO date string (YYYY-MM-DD) for date-ranged searches */
  fromDate?: string;
  /** ISO date string (YYYY-MM-DD) for historical mode end date */
  toDate?: string;
  /** Max search results (informational only — new API has no max_search_results param) */
  maxResults?: number;
  /** Override the Grok model */
  model?: string;
}

export interface SearchResult {
  content: string;
  citations: Citation[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Citation {
  url: string;
  title?: string;
}

// ── Tool types for the Responses API ────────────────────────────────

interface XSearchTool {
  type: 'x_search';
  allowed_x_handles?: string[];
  from_date?: string;
  to_date?: string;
}

interface WebSearchTool {
  type: 'web_search';
  from_date?: string;
  to_date?: string;
}

type SearchTool = XSearchTool | WebSearchTool;

interface ModeConfig {
  systemPrompt: string;
  tools: SearchTool[];
  fromDate?: string;
  toDate?: string;
}

// ── Mode Configurations ─────────────────────────────────────────────

const DEFAULT_HANDLES = [
  'NathsEU',
  'MerveHickok',
  'RaviNaikQC',
  'TheZvi',
  'yaborskiy',
  'BertuzLuca',
  'MajaBrekan',
  'DrJessicaFjeld',
];

function getModeConfig(mode: SearchMode, options: SearchOptions): ModeConfig {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  switch (mode) {
    case 'tech_leaders': {
      // max 10 handles per API constraint
      const handles = (options.handles ?? DEFAULT_HANDLES).slice(0, 10);
      return {
        systemPrompt:
          'You are searching X (Twitter) posts from specific tech leaders and AI experts. Focus on extracting their key insights, opinions, and any debates between them. Provide a balanced summary of different viewpoints.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search', allowed_x_handles: handles }],
        fromDate: options.fromDate ?? thirtyDaysAgo,
      };
    }

    case 'breaking_news':
      return {
        systemPrompt:
          'You are monitoring X for breaking news and current events. Focus on the most recent and impactful stories. Summarize key developments, public reactions, and overall sentiment. Prioritize accuracy and include multiple perspectives where available.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search' }],
      };

    case 'multi_source':
      // news_search does not exist in the new API — use web_search as the non-X source
      return {
        systemPrompt:
          'You are conducting comprehensive research using X posts and web sources. Compare and contrast information from different sources. Identify consensus views and conflicting opinions. Provide a balanced, well-researched analysis with clear conclusions.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search' }, { type: 'web_search' }],
        fromDate: options.fromDate ?? thirtyDaysAgo,
      };

    case 'historical':
      return {
        systemPrompt:
          'You are analyzing historical X data to understand how past events unfolded and were perceived. Focus on capturing the timeline of reactions, key moments of discussion, and how sentiment evolved. Provide context about what was happening at that time.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search' }],
        fromDate: options.fromDate ?? '2025-01-01',
        toDate: options.toDate ?? today,
      };

    case 'memes_trends':
      return {
        systemPrompt:
          'You are analyzing viral content and trending topics on X. Focus on identifying popular memes, funny trends, and viral phenomena. Explain why these are resonating with people and include cultural context where relevant.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search' }],
        fromDate: options.fromDate ?? thirtyDaysAgo,
      };

    case 'community_pulse':
      return {
        systemPrompt:
          'You are analyzing specific community discussions on X. Focus on technical insights, community consensus, debates, and emerging trends within the specified community. Highlight both popular and contrarian viewpoints to give a complete picture.' +
          ' ' +
          ATTRIBUTION_RULE,
        tools: [{ type: 'x_search' }],
        fromDate: options.fromDate ?? thirtyDaysAgo,
      };
  }
}

// Attribution rule injected into every mode's system prompt so Grok consistently
// returns author + publication date for each source. Radar relies on this to
// render attributed citations in #radar-feed.
const ATTRIBUTION_RULE =
  'ATTRIBUTION (required): For every post, article, or source you cite, include (a) the original author — full name when known, otherwise the @handle — and (b) the publication date in ISO format (YYYY-MM-DD). Use the post or article publication date, not today. If the source has no resolvable author or date, omit it rather than citing it unattributed. Format each citation inline as: "[Author / @handle, YYYY-MM-DD](url)".';

// ── Core Search Function ────────────────────────────────────────────

/**
 * Search X (Twitter) and optionally web sources via the Grok Responses API.
 *
 * @param query - The search query / question
 * @param mode - Which search mode to use (determines tools, prompts, defaults)
 * @param options - Optional overrides for handles, dates, model
 * @returns Structured search result with content and citations
 */
export async function grokSearch(
  query: string,
  mode: SearchMode = 'community_pulse',
  options: SearchOptions = {},
): Promise<SearchResult> {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not set. Add it to .env for Grok X search.');
  }

  const config = getModeConfig(mode, options);
  const model = options.model ?? DEFAULT_MODEL;

  // Inject date constraints into tools if fromDate/toDate apply
  const tools: SearchTool[] = config.tools.map((tool) => {
    const withDates = { ...tool } as unknown as Record<string, unknown>;
    if (config.fromDate) withDates.from_date = config.fromDate;
    if (config.toDate) withDates.to_date = config.toDate;
    return withDates as unknown as SearchTool;
  });

  const body = {
    model,
    input: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: query },
    ],
    tools,
  };

  logger.info({ mode, model, query: query.slice(0, 100) }, 'Grok search request');

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, error: errorText },
      'Grok API request failed',
    );
    throw new Error(`Grok API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    output?: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
        annotations?: Array<{
          type: string;
          url?: string;
          title?: string;
          start_index?: number;
          end_index?: number;
        }>;
      }>;
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };

  // Extract text content from the message output item
  const messageOutput = data.output?.find((o) => o.type === 'message');
  const textContent = messageOutput?.content?.find((c) => c.type === 'output_text');
  const content = textContent?.text ?? '';

  // Extract citations from annotations on the text content item
  const allCitations: Citation[] = [];
  for (const outputItem of data.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      for (const annotation of contentItem.annotations ?? []) {
        if (annotation.type === 'url_citation' && annotation.url) {
          allCitations.push({ url: annotation.url, title: annotation.title });
        }
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const dedupedCitations = allCitations.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  const xOnlyCitations = dedupedCitations.filter(
    (c) => c.url.includes('x.com/') || c.url.includes('twitter.com/'),
  );

  // For multi_source mode, keep all citations. For X-only modes, filter.
  const citations = mode === 'multi_source' ? dedupedCitations : xOnlyCitations;

  const usage = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  logger.info(
    { mode, citationCount: citations.length, contentLength: content.length },
    'Grok search complete',
  );

  return { content, citations, model, usage };
}

// ── Convenience Functions ───────────────────────────────────────────

/** Search what specific governance voices are posting about a topic */
export const searchTechLeaders = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'tech_leaders', options);

/** Get breaking news from X */
export const searchBreakingNews = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'breaking_news', options);

/** Multi-source analysis: X + web */
export const searchMultiSource = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'multi_source', options);

/** Historical X analysis with date ranges */
export const searchHistorical = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'historical', options);

/** Find memes and trending content */
export const searchMemesTrends = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'memes_trends', options);

/** Community pulse check: sentiment and discussions */
export const searchCommunityPulse = (query: string, options?: SearchOptions) =>
  grokSearch(query, 'community_pulse', options);

/**
 * Check if the Grok search integration is configured (API key present).
 */
export function isGrokSearchConfigured(): boolean {
  return !!XAI_API_KEY;
}
