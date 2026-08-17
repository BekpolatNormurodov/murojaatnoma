/**
 * Pure helpers for comparing face-recognition embedding vectors. Used both
 * to score a live check-in scan against enrolled FaceTemplates and by the
 * standalone `/attendance/verify-face` endpoint.
 */

/**
 * Cosine similarity between two embedding vectors. Returns a value in
 * [-1, 1] (in practice close to [0, 1] for L2-normalized face embeddings).
 * Returns 0 if the vectors have different lengths, either is empty, or
 * either is a zero vector, rather than throwing.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Best (maximum) cosine similarity between a probe embedding and a set of
 * enrolled template embeddings. Returns 0 if there are no templates to
 * compare against.
 */
export function bestMatchScore(probe: number[], templates: number[][]): number {
  if (templates.length === 0) {
    return 0;
  }

  return Math.max(...templates.map((template) => cosineSimilarity(probe, template)));
}
