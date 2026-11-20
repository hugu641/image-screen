/** True when a video plays only an excerpt of its full length. */
export const isTrimmed = (item) =>
  Boolean(item.duration && item.trim_end != null && (item.trim_start > 0.05 || item.trim_end < item.duration - 0.05));
