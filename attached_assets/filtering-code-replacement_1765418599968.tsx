// ============================================================================
// ENHANCED FILTERING - Replace lines 1028-1074 with this code
// ============================================================================

// Helper function for robust generation validation
// Filters out failed generations even if marked as "completed"
const isValidGeneration = useCallback((g: Generation): boolean => {
  // Must have completed status
  if (g.status !== "completed") return false;
  
  // CRITICAL: Must NOT have an error message
  // Failed generations sometimes have status="completed" but errorMessage set
  if (g.errorMessage && g.errorMessage.trim() !== '') return false;
  
  // Must have a valid resultUrl
  if (!g.resultUrl || g.resultUrl.trim() === '') return false;
  
  // Must not contain 'undefined' or 'null' as strings in URL
  // Catches backend string interpolation failures
  if (g.resultUrl.includes('undefined') || g.resultUrl.includes('null')) return false;
  
  // Must have valid URL format (catches malformed URLs)
  try {
    new URL(g.resultUrl);
    return true;
  } catch {
    return false;
  }
}, []);

// Flatten video pages and filter for TRULY completed videos with valid URLs
const allVideos = useMemo(() => {
  const items = videoData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [videoData, isValidGeneration]);

// Flatten and filter music tracks (completed with valid URLs)
const musicTracks = useMemo(() => {
  const items = musicData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [musicData, isValidGeneration]);

// Flatten and filter audio tracks (completed with valid URLs)
const voiceTracks = useMemo(() => {
  const items = audioData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [audioData, isValidGeneration]);

// Flatten and filter images (completed with valid URLs)
const allImages = useMemo(() => {
  const items = imageData?.pages.flatMap(page => page.items) ?? [];
  return items.filter(isValidGeneration);
}, [imageData, isValidGeneration]);

// Avatar videos from video query (filter by model type AND validation)
const avatarVideos = useMemo(() => {
  const items = videoData?.pages.flatMap(page => page.items) ?? [];
  return items.filter((g) => {
    // Must be avatar type
    const model = (g.model ?? "").toLowerCase();
    const isAvatar = g.type === "talking-avatar" || 
                     g.type === "avatar" || 
                     model.includes("infinitetalk") || 
                     model.includes("infinite-talk");
    
    // Must also pass validation (no errors, valid URL)
    return isAvatar && isValidGeneration(g);
  });
}, [videoData, isValidGeneration]);
