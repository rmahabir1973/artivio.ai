/**
 * Cross-Layer Transitions Module for FFmpeg Video Processing
 * Handles transitions between clips on different timeline layers
 * 
 * This module generates proper FFmpeg filter graphs for cross-layer
 * transitions based on absolute timeline positions, trim, speed, and layers.
 * 
 * Deploy alongside server.js on your VPS
 */

const TRANSITION_MAP = {
  'fade': 'fade',
  'dissolve': 'dissolve',
  'fadeblack': 'fadeblack',
  'fadewhite': 'fadewhite',
  'wipeleft': 'wipeleft',
  'wiperight': 'wiperight',
  'wipeup': 'wipeup',
  'wipedown': 'wipedown',
  'slideleft': 'slideleft',
  'slideright': 'slideright',
  'slideup': 'slideup',
  'slidedown': 'slidedown',
  'circleopen': 'circleopen',
  'circleclose': 'circleclose',
  'pixelize': 'pixelize',
  'radial': 'radial',
  'diagtl': 'diagtl',
  'diagtr': 'diagtr',
  'diagbl': 'diagbl',
  'diagbr': 'diagbr',
  'smoothleft': 'smoothleft',
  'smoothright': 'smoothright',
  'smoothup': 'smoothup',
  'smoothdown': 'smoothdown',
  'hlslice': 'hlslice',
  'hrslice': 'hrslice',
  'vuslice': 'vuslice',
  'vdslice': 'vdslice',
  'hblur': 'hblur',
  'fadegrays': 'fadegrays',
  'wipetl': 'wipetl',
  'wipetr': 'wipetr',
  'wipebl': 'wipebl',
  'wipebr': 'wipebr',
  'squeezeh': 'squeezeh',
  'squeezev': 'squeezev',
  'zoomin': 'zoomin'
};

function getFFmpegTransitionType(type) {
  const normalized = (type || 'fade').toLowerCase();
  return TRANSITION_MAP[normalized] || 'fade';
}

/**
 * Calculate target dimensions based on video settings and enhancements
 */
function calculateTargetDimensions(videoSettings, enhancements) {
  let targetWidth = 1920;
  let targetHeight = 1080;
  
  if (enhancements?.aspectRatio) {
    switch (enhancements.aspectRatio) {
      case '9:16':
        targetWidth = 1080;
        targetHeight = 1920;
        break;
      case '1:1':
        targetWidth = 1080;
        targetHeight = 1080;
        break;
      case '4:3':
        targetWidth = 1440;
        targetHeight = 1080;
        break;
      default:
        targetWidth = 1920;
        targetHeight = 1080;
    }
  }
  
  if (videoSettings?.resolution) {
    const scale = videoSettings.resolution === '720p' ? 0.667 : 
                  videoSettings.resolution === '480p' ? 0.444 :
                  videoSettings.resolution === '4k' ? 2 : 1;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }
  
  return { targetWidth, targetHeight };
}

/**
 * Main function called by server.js
 * 
 * Cross-layer transitions work by:
 * 1. Identifying overlapping clips on different layers
 * 2. Calculating the overlap region where xfade should occur
 * 3. Building a composite filter graph that handles all clips
 */
function processCrossLayerTransitions(payload, downloadedClips) {
  const { 
    clips, 
    multiTrackTimeline, 
    crossLayerTransitions, 
    videoSettings, 
    enhancements 
  } = payload;
  
  console.log('[CrossLayer] Processing cross-layer transitions');
  console.log('[CrossLayer] Timeline items:', multiTrackTimeline?.items?.length || 0);
  console.log('[CrossLayer] Cross-layer transitions:', crossLayerTransitions?.length || 0);
  
  if (!crossLayerTransitions || crossLayerTransitions.length === 0) {
    console.log('[CrossLayer] No cross-layer transitions to process');
    return null;
  }
  
  if (!multiTrackTimeline || !multiTrackTimeline.items || multiTrackTimeline.items.length === 0) {
    console.warn('[CrossLayer] No multiTrackTimeline items found');
    return null;
  }
  
  const { targetWidth, targetHeight } = calculateTargetDimensions(videoSettings, enhancements);
  console.log(`[CrossLayer] Target dimensions: ${targetWidth}x${targetHeight}`);
  
  // Build maps for quick lookup
  const clipIdToDownloaded = new Map();
  for (const clip of downloadedClips) {
    clipIdToDownloaded.set(clip.id, clip);
  }
  
  const clipIdToTimelineItem = new Map();
  for (const item of multiTrackTimeline.items) {
    if (item.type === 'video') {
      clipIdToTimelineItem.set(item.id, item);
    }
  }
  
  const filterSteps = [];
  const processedClipLabels = new Map(); // clipId -> processed video label
  const processedAudioLabels = new Map(); // clipId -> processed audio label
  
  // Process each cross-layer transition
  for (let i = 0; i < crossLayerTransitions.length; i++) {
    const transition = crossLayerTransitions[i];
    const { fromClipId, toClipId, type, durationSeconds } = transition;
    
    const fromTimelineItem = clipIdToTimelineItem.get(fromClipId);
    const toTimelineItem = clipIdToTimelineItem.get(toClipId);
    
    if (!fromTimelineItem || !toTimelineItem) {
      console.warn(`[CrossLayer] Transition ${i}: Timeline items not found`);
      continue;
    }
    
    const fromDownloaded = clipIdToDownloaded.get(fromClipId);
    const toDownloaded = clipIdToDownloaded.get(toClipId);
    
    if (!fromDownloaded || !toDownloaded) {
      console.warn(`[CrossLayer] Transition ${i}: Downloaded clips not found`);
      continue;
    }
    
    const fromIndex = fromDownloaded.index;
    const toIndex = toDownloaded.index;
    
    // Timeline positions (absolute)
    const fromStart = fromTimelineItem.startTime || 0;
    const fromDuration = fromTimelineItem.duration || fromDownloaded.actualDuration || 5;
    const fromEnd = fromStart + fromDuration;
    
    const toStart = toTimelineItem.startTime || 0;
    const toDuration = toTimelineItem.duration || toDownloaded.actualDuration || 5;
    const toEnd = toStart + toDuration;
    
    // Calculate overlap region
    const overlapStart = Math.max(fromStart, toStart);
    const overlapEnd = Math.min(fromEnd, toEnd);
    const overlapDuration = overlapEnd - overlapStart;
    
    if (overlapDuration <= 0) {
      console.warn(`[CrossLayer] Transition ${i}: No overlap between clips`);
      continue;
    }
    
    // Transition duration is clamped to overlap
    const transitionDuration = Math.min(durationSeconds || 1.0, overlapDuration);
    const ffmpegType = getFFmpegTransitionType(type);
    
    console.log(`[CrossLayer] Transition ${i}: ${fromClipId}[${fromIndex}] -> ${toClipId}[${toIndex}]`);
    console.log(`[CrossLayer]   From: ${fromStart.toFixed(2)}s - ${fromEnd.toFixed(2)}s`);
    console.log(`[CrossLayer]   To: ${toStart.toFixed(2)}s - ${toEnd.toFixed(2)}s`);
    console.log(`[CrossLayer]   Overlap: ${overlapStart.toFixed(2)}s - ${overlapEnd.toFixed(2)}s (${overlapDuration.toFixed(2)}s)`);
    console.log(`[CrossLayer]   Transition: ${ffmpegType} for ${transitionDuration.toFixed(2)}s`);
    
    // Process FROM clip if not already done
    if (!processedClipLabels.has(fromClipId)) {
      const fromLabel = `v${fromIndex}_proc`;
      const fromFilters = buildClipProcessingFilters(fromTimelineItem, targetWidth, targetHeight);
      filterSteps.push(`[${fromIndex}:v]${fromFilters}[${fromLabel}]`);
      processedClipLabels.set(fromClipId, fromLabel);
      
      // Audio
      if (fromDownloaded.hasAudio && !fromTimelineItem.muted) {
        const aFromLabel = `a${fromIndex}_proc`;
        const aFromFilters = buildAudioProcessingFilters(fromTimelineItem);
        filterSteps.push(`[${fromIndex}:a]${aFromFilters}[${aFromLabel}]`);
        processedAudioLabels.set(fromClipId, aFromLabel);
      }
    }
    
    // Process TO clip if not already done
    if (!processedClipLabels.has(toClipId)) {
      const toLabel = `v${toIndex}_proc`;
      const toFilters = buildClipProcessingFilters(toTimelineItem, targetWidth, targetHeight);
      filterSteps.push(`[${toIndex}:v]${toFilters}[${toLabel}]`);
      processedClipLabels.set(toClipId, toLabel);
      
      // Audio
      if (toDownloaded.hasAudio && !toTimelineItem.muted) {
        const aToLabel = `a${toIndex}_proc`;
        const aToFilters = buildAudioProcessingFilters(toTimelineItem);
        filterSteps.push(`[${toIndex}:a]${aToFilters}[${aToLabel}]`);
        processedAudioLabels.set(toClipId, aToLabel);
      }
    }
    
    const fromLabel = processedClipLabels.get(fromClipId);
    const toLabel = processedClipLabels.get(toClipId);
    
    // Calculate xfade offset in the composition
    // For the first clip, offset is where transition starts relative to clip start
    // xfade offset = (fromDuration - transitionDuration) for clips starting at 0
    // For timeline-positioned clips: we need to consider absolute positioning
    
    // In a two-clip xfade, offset is when the transition starts in the output
    // The from clip plays from 0 to (fromDuration - transitionDuration + transitionDuration) = fromDuration
    // But the transition starts at (fromDuration - transitionDuration)
    
    // For timeline-based: the transition should start at (overlapEnd - transitionDuration) in absolute time
    // But xfade works on the concatenated streams, so:
    // offset = position where from clip ends minus transition duration
    const xfadeOffset = Math.max(0, fromDuration - transitionDuration);
    
    const outputLabel = `xfade_${i}`;
    filterSteps.push(`[${fromLabel}][${toLabel}]xfade=transition=${ffmpegType}:duration=${transitionDuration.toFixed(3)}:offset=${xfadeOffset.toFixed(3)}[${outputLabel}]`);
    
    // Update the label for the FROM clip to the xfade output (for chaining)
    processedClipLabels.set(fromClipId, outputLabel);
    // Also update TO clip to point to the xfade output since they're now merged
    processedClipLabels.set(toClipId, outputLabel);
    
    // Audio crossfade
    const fromAudioLabel = processedAudioLabels.get(fromClipId);
    const toAudioLabel = processedAudioLabels.get(toClipId);
    
    if (fromAudioLabel && toAudioLabel) {
      const audioOutputLabel = `axfade_${i}`;
      filterSteps.push(`[${fromAudioLabel}][${toAudioLabel}]acrossfade=d=${transitionDuration.toFixed(3)}:c1=tri:c2=tri[${audioOutputLabel}]`);
      processedAudioLabels.set(fromClipId, audioOutputLabel);
      processedAudioLabels.set(toClipId, audioOutputLabel);
    } else if (fromAudioLabel) {
      // Only from has audio - keep it
      processedAudioLabels.set(toClipId, fromAudioLabel);
    } else if (toAudioLabel) {
      // Only to has audio - keep it
      processedAudioLabels.set(fromClipId, toAudioLabel);
    } else {
      // Neither has audio - generate silence for the combined duration
      const combinedDuration = fromDuration + toDuration - transitionDuration;
      const silentLabel = `asilent_${i}`;
      filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${combinedDuration.toFixed(3)}[${silentLabel}]`);
      processedAudioLabels.set(fromClipId, silentLabel);
      processedAudioLabels.set(toClipId, silentLabel);
    }
  }
  
  if (filterSteps.length === 0) {
    console.log('[CrossLayer] No valid filters generated');
    return null;
  }
  
  // Find the final video and audio labels
  // They should be the last xfade outputs
  const lastTransitionIdx = crossLayerTransitions.length - 1;
  let finalVideoLabel = `xfade_${lastTransitionIdx}`;
  let finalAudioLabel = null;
  
  // Find the audio label from the last transition's clips
  const lastTransition = crossLayerTransitions[lastTransitionIdx];
  if (lastTransition) {
    finalAudioLabel = processedAudioLabels.get(lastTransition.fromClipId) || 
                      processedAudioLabels.get(lastTransition.toClipId);
  }
  
  // Generate silent audio if none exists
  if (!finalAudioLabel) {
    // Calculate total duration from timeline
    let maxEndTime = 0;
    for (const item of multiTrackTimeline.items) {
      if (item.type === 'video') {
        const endTime = (item.startTime || 0) + (item.duration || 5);
        maxEndTime = Math.max(maxEndTime, endTime);
      }
    }
    filterSteps.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${maxEndTime.toFixed(3)}[final_silent]`);
    finalAudioLabel = 'final_silent';
  }
  
  // Add final null filters to create [outv] and [outa]
  filterSteps.push(`[${finalVideoLabel}]null[outv]`);
  filterSteps.push(`[${finalAudioLabel}]anull[outa]`);
  
  const filterComplex = filterSteps.join(';');
  
  console.log(`[CrossLayer] Generated filter complex with ${filterSteps.length} steps`);
  
  return {
    filterComplex,
    videoOutput: '[outv]',
    audioOutput: '[outa]'
  };
}

/**
 * Build video processing filters for a clip
 */
function buildClipProcessingFilters(timelineItem, targetWidth, targetHeight) {
  const filters = [];
  
  const trimStart = timelineItem.trim?.start || 0;
  const trimEnd = timelineItem.trim?.end;
  const speed = timelineItem.speed || 1;
  
  // Trim filter
  if (trimStart > 0 || trimEnd !== undefined) {
    if (trimEnd !== undefined) {
      filters.push(`trim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)}`);
    } else {
      filters.push(`trim=start=${trimStart.toFixed(3)}`);
    }
    filters.push('setpts=PTS-STARTPTS');
  }
  
  // Speed adjustment
  if (speed !== 1) {
    filters.push(`setpts=${(1.0 / speed).toFixed(4)}*PTS`);
  }
  
  // Scale and pad to target dimensions
  filters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
  filters.push('setsar=1');
  filters.push('fps=30');
  
  return filters.join(',');
}

/**
 * Build audio processing filters for a clip
 */
function buildAudioProcessingFilters(timelineItem) {
  const filters = [];
  
  const trimStart = timelineItem.trim?.start || 0;
  const trimEnd = timelineItem.trim?.end;
  const speed = timelineItem.speed || 1;
  const volume = timelineItem.muted ? 0 : (timelineItem.volume ?? 1);
  
  // Trim audio
  if (trimStart > 0 || trimEnd !== undefined) {
    if (trimEnd !== undefined) {
      filters.push(`atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)}`);
    } else {
      filters.push(`atrim=start=${trimStart.toFixed(3)}`);
    }
    filters.push('asetpts=PTS-STARTPTS');
  }
  
  // Speed adjustment
  if (speed !== 1) {
    if (speed <= 2) {
      filters.push(`atempo=${speed.toFixed(4)}`);
    } else {
      filters.push('atempo=2.0');
      filters.push(`atempo=${(speed / 2).toFixed(4)}`);
    }
  }
  
  // Volume adjustment
  if (volume !== 1) {
    filters.push(`volume=${volume.toFixed(3)}`);
  }
  
  // Normalize audio format
  filters.push('aresample=async=1:first_pts=0');
  filters.push('aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo');
  
  return filters.join(',');
}

module.exports = {
  processCrossLayerTransitions
};
