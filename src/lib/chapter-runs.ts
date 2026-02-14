type ChunkLike = {
  id: string;
  index: number;
  chapterTitle: string | null;
};

export interface ChapterRun {
  title: string;
  chunkIds: string[];
  chunkIndices: number[];
}

export function buildChapterRuns(chunks: ChunkLike[]): ChapterRun[] {
  const runs: ChapterRun[] = [];

  for (const chunk of chunks) {
    const title = chunk.chapterTitle ?? "Untitled";
    const prev = runs[runs.length - 1];

    if (prev && prev.title === title) {
      prev.chunkIds.push(chunk.id);
      prev.chunkIndices.push(chunk.index);
      continue;
    }

    runs.push({
      title,
      chunkIds: [chunk.id],
      chunkIndices: [chunk.index],
    });
  }

  return runs;
}
