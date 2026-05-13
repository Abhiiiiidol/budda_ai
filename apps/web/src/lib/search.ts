import { embedText } from "@/lib/gemini/embed";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  title: string;
  content: string | null;
  context: string | null;
  entry_type: string;
  source: string;
  link: string | null;
  similarity: number;
};

export async function semanticSearch(params: {
  query: string;
  productId: string;
  topK?: number;
  threshold?: number;
}): Promise<SearchResult[]> {
  const { query, productId, topK = 15, threshold = 0.3 } = params;

  const queryEmbedding = await embedText(query);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("match_entries", {
    query_embedding: queryEmbedding,
    match_product_id: productId,
    match_count: topK,
    match_threshold: threshold,
  });

  if (error) {
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  return (data ?? []) as SearchResult[];
}
