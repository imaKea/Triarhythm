export function resolveDifficultyBeatmap(song, difficulty) {
  if (difficulty?.beatmap?.notes && Array.isArray(difficulty.beatmap.notes)) {
    return difficulty.beatmap;
  }

  if (Array.isArray(difficulty?.notes)) {
    return difficulty;
  }

  if ((song?.difficulties?.length || 0) <= 1) {
    if (song?.beatmap?.notes && Array.isArray(song.beatmap.notes)) {
      return song.beatmap;
    }

    if (Array.isArray(song?.notes)) {
      return song;
    }
  }

  return null;
}
