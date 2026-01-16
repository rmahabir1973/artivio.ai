/**
 * Video Decoder Web Worker
 * Runs WebCodecs VideoDecoder off the main thread to prevent UI freezing
 * Handles video loading, demuxing with MP4Box, and frame decoding
 */

// @ts-ignore - MP4Box types not available
import * as MP4Box from 'mp4box';

interface DecoderMessage {
  type: 'load' | 'seek' | 'buffer' | 'destroy';
  videoId?: string;
  url?: string;
  time?: number;
  items?: Array<{
    id: string;
    startTime: number;
    duration: number;
    trim?: { start: number; end: number };
    speed?: number;
  }>;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

// Limit video chunks to prevent memory exhaustion (~100 seconds at 30fps)
const MAX_VIDEO_CHUNKS = 3000;

class VideoDecoderWorker {
  private decoders: Map<string, {
    decoder: VideoDecoder;
    metadata: VideoMetadata | null;
    videoData: EncodedVideoChunk[];
    mp4boxFile: any;
    frameBuffer: Map<number, VideoFrame>;
    isReady: boolean;
  }> = new Map();

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    this.sendMessage({ type: 'ready' });
  }

  private sendMessage(message: any, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      self.postMessage(message, { transfer });
    } else {
      self.postMessage(message);
    }
  }

  private async handleMessage(event: MessageEvent<DecoderMessage>): Promise<void> {
    const { type, videoId, url, time, items } = event.data;

    try {
      switch (type) {
        case 'load':
          if (videoId && url) {
            await this.loadVideo(videoId, url);
          }
          break;

        case 'seek':
          if (videoId && time !== undefined) {
            await this.seekVideo(videoId, time);
          }
          break;

        case 'buffer':
          if (time !== undefined && items) {
            await this.bufferFrames(time, items);
          }
          break;

        case 'destroy':
          if (videoId) {
            this.destroyVideo(videoId);
          }
          break;
      }
    } catch (error) {
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load and initialize a video
   */
  private async loadVideo(videoId: string, url: string): Promise<void> {
    // Check if already loaded - prevent duplicate loads
    if (this.decoders.has(videoId)) {
      const existing = this.decoders.get(videoId);
      if (existing?.isReady) {
        // Already loaded, just send the loaded message again
        this.sendMessage({
          type: 'loaded',
          videoId,
          metadata: existing.metadata,
        });
        return;
      }
    }

    this.sendMessage({ type: 'loading', videoId, progress: 0 });

    try {
      // Validate URL - must be absolute URL (http://, https://, blob:, or data:)
      const validProtocols = ['http://', 'https://', 'blob:', 'data:'];
      const hasValidProtocol = validProtocols.some(protocol => url.startsWith(protocol));
      if (!hasValidProtocol) {
        throw new Error(`Invalid URL: ${url} - must be an absolute URL (http://, https://, blob:, or data:)`);
      }

      // Fetch video data with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response: Response;
      let blob: Blob;
      let arrayBuffer: ArrayBuffer;
      
      try {
        response = await fetch(url, { signal: controller.signal });
        
        // Check for errors
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status} ${response.statusText} for ${url}`);
        }
        
        blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      } finally {
        clearTimeout(timeoutId);
      }

      // Create MP4Box file for demuxing
      const mp4boxFile = MP4Box.createFile();
      
      // Shared state for sample extraction
      const videoData: EncodedVideoChunk[] = [];
      const frameBuffer = new Map<number, VideoFrame>();
      let decoder: VideoDecoder | null = null;
      let samplesResolve: (() => void) | null = null;
      let sampleCount = 0;

      // Set up onSamples BEFORE parsing - this is critical for mp4box
      mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
        console.log(`[VideoDecoder] Received ${samples.length} samples for ${videoId}`);
        
        for (const sample of samples) {
          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: (sample.cts * 1000000) / sample.timescale,
            duration: (sample.duration * 1000000) / sample.timescale,
            data: sample.data,
          });
          videoData.push(chunk);
        }
        
        sampleCount += samples.length;

        // Limit memory: remove oldest non-keyframe chunks when over limit
        if (videoData.length > MAX_VIDEO_CHUNKS) {
          const excess = videoData.length - MAX_VIDEO_CHUNKS;
          let removed = 0;
          for (let i = 0; i < videoData.length && removed < excess; i++) {
            if (videoData[i].type !== 'key') {
              videoData.splice(i, 1);
              removed++;
              i--; // Adjust index after splice
            }
          }
        }
        
        // Resolve the samples promise after we've received samples
        if (samplesResolve && sampleCount > 0) {
          samplesResolve();
          samplesResolve = null;
        }
      };

      // Track info for codec configuration
      let videoTrackInfo: any = null;
      let codecDescription: Uint8Array | undefined = undefined;

      // Extract metadata and setup decoder - extraction happens inside onReady
      const metadata = await new Promise<VideoMetadata>((resolve, reject) => {
        mp4boxFile.onError = (e: any) => reject(e);

        mp4boxFile.onReady = (info: any) => {
          console.log(`[VideoDecoder] onReady fired for ${videoId}`);

          const videoTrack = info.videoTracks[0];
          if (!videoTrack) {
            reject(new Error('No video track found'));
            return;
          }

          videoTrackInfo = videoTrack;

          const metadata: VideoMetadata = {
            duration: info.duration / info.timescale,
            width: videoTrack.video.width,
            height: videoTrack.video.height,
            frameRate: videoTrack.nb_samples / (info.duration / info.timescale),
            hasVideo: info.videoTracks.length > 0,
            hasAudio: info.audioTracks.length > 0,
          };

          // Extract codec description for H.264/H.265
          // This is REQUIRED for AVC formatted H.264 to decode properly
          try {
            const trak = mp4boxFile.getTrackById(videoTrack.id);
            if (trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]) {
              const entry = trak.mdia.minf.stbl.stsd.entries[0];

              // Check for avcC (H.264)
              if (entry.avcC) {
                const avcC = entry.avcC;
                // Manually serialize AVCDecoderConfigurationRecord
                // Structure: configVersion(1) + profile(1) + compat(1) + level(1) +
                //           lengthSize(1) + numSPS(1) + [spsLen(2) + spsData]... +
                //           numPPS(1) + [ppsLen(2) + ppsData]...

                let totalSize = 6; // Fixed header bytes
                const spsArray = avcC.SPS || [];
                const ppsArray = avcC.PPS || [];

                for (const sps of spsArray) {
                  totalSize += 2 + sps.length; // 2 bytes length + data
                }
                totalSize += 1; // numPPS byte
                for (const pps of ppsArray) {
                  totalSize += 2 + pps.length; // 2 bytes length + data
                }

                const buffer = new ArrayBuffer(totalSize);
                const view = new DataView(buffer);
                const bytes = new Uint8Array(buffer);
                let offset = 0;

                // Write header
                view.setUint8(offset++, avcC.configurationVersion || 1);
                view.setUint8(offset++, avcC.AVCProfileIndication || 100);
                view.setUint8(offset++, avcC.profile_compatibility || 0);
                view.setUint8(offset++, avcC.AVCLevelIndication || 31);
                view.setUint8(offset++, 0xFF); // 6 bits reserved (all 1s) + 2 bits lengthSizeMinusOne (3 = 4 bytes)
                view.setUint8(offset++, 0xE0 | spsArray.length); // 3 bits reserved (all 1s) + 5 bits numSPS

                // Write SPS
                for (const sps of spsArray) {
                  view.setUint16(offset, sps.length);
                  offset += 2;
                  bytes.set(new Uint8Array(sps.buffer || sps), offset);
                  offset += sps.length;
                }

                // Write PPS count and data
                view.setUint8(offset++, ppsArray.length);
                for (const pps of ppsArray) {
                  view.setUint16(offset, pps.length);
                  offset += 2;
                  bytes.set(new Uint8Array(pps.buffer || pps), offset);
                  offset += pps.length;
                }

                codecDescription = bytes;
                console.log(`[VideoDecoder] Extracted avcC description: ${codecDescription.length} bytes, SPS: ${spsArray.length}, PPS: ${ppsArray.length}`);
              } else if (entry.hvcC) {
                // For HEVC, try the DataStream approach
                const stream = new (MP4Box as any).DataStream(undefined, 0, (MP4Box as any).DataStream.BIG_ENDIAN);
                entry.hvcC.write(stream);
                codecDescription = new Uint8Array(stream.buffer, 8);
                console.log(`[VideoDecoder] Extracted hvcC description: ${codecDescription.length} bytes`);
              }
            }
          } catch (e) {
            console.warn(`[VideoDecoder] Could not extract codec description:`, e);
          }

          // Set extraction options and start INSIDE onReady - this is critical!
          console.log(`[VideoDecoder] Setting extraction options for track ${videoTrack.id}`);
          mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
          mp4boxFile.start();
          console.log(`[VideoDecoder] Extraction started for ${videoId}`);

          resolve(metadata);
        };

        // Feed file data
        const buffer = arrayBuffer as any;
        buffer.fileStart = 0;
        mp4boxFile.appendBuffer(buffer);
        mp4boxFile.flush();
      });

      // Track decode errors to prevent spam
      let decodeErrorCount = 0;
      let lastErrorMessage = '';

      // Create decoder
      decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const timestamp = frame.timestamp / 1000000; // to seconds

          // Send frame to main thread (transfer ownership for zero-copy)
          this.sendMessage({
            type: 'frame',
            videoId,
            timestamp,
            frame,
          }, [frame]);
        },
        error: (error: Error) => {
          decodeErrorCount++;
          // Only log first error and every 100th after to prevent console spam
          if (decodeErrorCount === 1 || decodeErrorCount % 100 === 0) {
            console.error(`[VideoDecoder] Decoder error #${decodeErrorCount} for ${videoId}:`, error.message);
          }
          // Only send first error to main thread
          if (lastErrorMessage !== error.message) {
            lastErrorMessage = error.message;
            this.sendMessage({
              type: 'error',
              videoId,
              error: error.message,
            });
          }
        },
      });

      // Configure decoder with codec description (required for H.264)
      // Use the codec string from mp4box videoTrack which is already properly formatted
      const codecString = videoTrackInfo?.codec || 'avc1.64001f';
      console.log(`[VideoDecoder] Configuring decoder with codec: ${codecString}`);
      console.log(`[VideoDecoder] Has codec description: ${codecDescription ? 'yes' : 'no'}`);

      const decoderConfig: VideoDecoderConfig = {
        codec: codecString,
        codedWidth: metadata.width,
        codedHeight: metadata.height,
        optimizeForLatency: true,
      };

      // Add description for H.264/H.265 - this is CRITICAL for AVC formatted video
      if (codecDescription) {
        decoderConfig.description = codecDescription;
      }

      decoder.configure(decoderConfig);

      // Wait for initial samples to be extracted (with timeout)
      const samplesPromise = new Promise<void>((resolve) => {
        if (sampleCount > 0) {
          resolve(); // Already have samples
        } else {
          samplesResolve = resolve;
        }
      });
      
      await Promise.race([
        samplesPromise,
        new Promise<void>(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ]);
      
      console.log(`[VideoDecoder] ${videoId} has ${videoData.length} chunks after extraction`);

      // Store decoder state
      this.decoders.set(videoId, {
        decoder,
        metadata,
        videoData,
        mp4boxFile,
        frameBuffer,
        isReady: true,
      });

      this.sendMessage({
        type: 'loaded',
        videoId,
        metadata,
      });

      // Pre-decode first several seconds of video for smooth playback start
      // Decode up to 180 frames (~6 seconds at 30fps) to have a buffer ready
      if (videoData.length > 0) {
        const framesToDecode = Math.min(videoData.length, 180);
        console.log(`[VideoDecoder] Pre-decoding ${framesToDecode} frames for ${videoId}`);

        for (let i = 0; i < framesToDecode; i++) {
          try {
            decoder.decode(videoData[i]);
          } catch (e) {
            console.warn(`[VideoDecoder] Error decoding frame ${i}:`, e);
            break;
          }

          // Yield every 30 frames to avoid blocking
          if (i % 30 === 29) {
            await decoder.flush();
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        await decoder.flush();
        console.log(`[VideoDecoder] Pre-decoded ${framesToDecode} frames for ${videoId}`);
      } else {
        console.warn(`[VideoDecoder] No video chunks available for ${videoId}`);
      }
    } catch (error) {
      this.sendMessage({
        type: 'error',
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Seek to specific time and decode surrounding frames
   */
  private async seekVideo(videoId: string, time: number): Promise<void> {
    const video = this.decoders.get(videoId);
    if (!video || !video.isReady) return;

    const { decoder, metadata, videoData, frameBuffer } = video;
    if (!metadata) return;

    // Find nearest keyframe before target
    const targetFrameIndex = Math.floor(time * metadata.frameRate);
    let keyframeIndex = 0;

    for (let i = 0; i < videoData.length; i++) {
      if (videoData[i].type === 'key') {
        const chunkTime = videoData[i].timestamp / 1000000;
        if (chunkTime <= time) {
          keyframeIndex = i;
        } else {
          break;
        }
      }
    }

    // Clear old frames
    frameBuffer.forEach(frame => frame.close());
    frameBuffer.clear();

    // Decode from keyframe to target + buffer
    const startIndex = keyframeIndex;
    const endIndex = Math.min(startIndex + 90, videoData.length);

    for (let i = startIndex; i < endIndex; i++) {
      if (decoder.state === 'closed') break;

      try {
        decoder.decode(videoData[i]);
      } catch (error) {
        console.error('Decode error:', error);
      }

      // Yield to worker thread every 2 frames (more responsive UI)
      if (i % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    await decoder.flush();

    this.sendMessage({
      type: 'seeked',
      videoId,
      time,
    });
  }

  /**
   * Pre-buffer frames for smooth playback
   */
  private async bufferFrames(
    time: number,
    items: Array<{
      id: string;
      startTime: number;
      duration: number;
      trim?: { start: number; end: number };
      speed?: number;
    }>
  ): Promise<void> {
    for (const item of items) {
      const video = this.decoders.get(item.id);
      if (!video || !video.isReady) continue;

      const timeInClip = time - item.startTime;
      if (timeInClip < -2 || timeInClip > item.duration + 2) continue;

      const speed = item.speed || 1;
      const trimStart = item.trim?.start || 0;
      const localTime = trimStart + (timeInClip * speed);

      await this.seekVideo(item.id, localTime);
    }
  }

  /**
   * Get codec string for VideoDecoder
   */
  private getCodecString(trackInfo: any): string {
    const codecMap: Record<string, string> = {
      'avc1': 'avc1.64001f', // H.264
      'hvc1': 'hvc1.1.6.L93.B0', // H.265
      'vp09': 'vp09.00.10.08', // VP9
      'av01': 'av01.0.04M.08', // AV1
    };

    const codecType = trackInfo?.codec || 'avc1';
    return codecMap[codecType] || codecType;
  }

  /**
   * Destroy a video decoder
   */
  private destroyVideo(videoId: string): void {
    const video = this.decoders.get(videoId);
    if (!video) return;

    // Close all frames
    video.frameBuffer.forEach(frame => frame.close());
    video.frameBuffer.clear();

    // Close decoder
    if (video.decoder.state !== 'closed') {
      video.decoder.close();
    }

    this.decoders.delete(videoId);

    this.sendMessage({
      type: 'destroyed',
      videoId,
    });
  }
}

// Initialize worker
new VideoDecoderWorker();
