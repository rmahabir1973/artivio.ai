# FFmpeg Video Editor - Complete Feature Guide

## Table of Contents
1. [Basic Video Operations](#basic-video-operations)
2. [Audio Operations](#audio-operations)
3. [Transitions](#transitions)
4. [Text Overlays](#text-overlays)
5. [Video Overlays & Avatars](#video-overlays--avatars)
6. [Visual Effects & Filters](#visual-effects--filters)
7. [Templates & Branding](#templates--branding)
8. [AWS Lambda Implementation](#aws-lambda-implementation)
9. [Complete Workflow Examples](#complete-workflow-examples)

---

## Basic Video Operations

### 1. Concatenate Videos (Simple Method)
For videos with identical encoding parameters:

```bash
# Create a file list
cat > filelist.txt << EOF
file 'video1.mp4'
file 'video2.mp4'
file 'video3.mp4'
EOF

# Concatenate
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
```

### 2. Concatenate Videos (Re-encode Method)
For videos with different resolutions/framerates:

```bash
ffmpeg -i video1.mp4 -i video2.mp4 -i video3.mp4 \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0]; \
                   [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1]; \
                   [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v2]; \
                   [v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" output.mp4
```

### 3. Trim Video
```bash
# Trim from 5 seconds to 15 seconds
ffmpeg -i input.mp4 -ss 00:00:05 -to 00:00:15 -c copy trimmed.mp4

# Trim with re-encoding (more precise)
ffmpeg -ss 00:00:05 -i input.mp4 -t 00:00:10 output.mp4
```

### 4. Change Video Speed
```bash
# Speed up 2x
ffmpeg -i input.mp4 -filter:v "setpts=0.5*PTS" -filter:a "atempo=2.0" output.mp4

# Slow down 0.5x
ffmpeg -i input.mp4 -filter:v "setpts=2.0*PTS" -filter:a "atempo=0.5" output.mp4
```

### 5. Resize Video
```bash
# Resize to 1920x1080 maintaining aspect ratio
ffmpeg -i input.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" output.mp4

# Resize to 720p
ffmpeg -i input.mp4 -vf "scale=-2:720" output.mp4
```

---

## Audio Operations

### 1. Add Background Music
```bash
# Add music with original audio
ffmpeg -i video.mp4 -i music.mp3 \
  -filter_complex "[1:a]volume=0.3[music];[0:a][music]amix=inputs=2:duration=shortest[aout]" \
  -map 0:v -map "[aout]" output.mp4
```

### 2. Replace Audio Track
```bash
ffmpeg -i video.mp4 -i newaudio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
```

### 3. Audio Ducking (Lower music when speech detected)
```bash
ffmpeg -i video.mp4 -i music.mp3 \
  -filter_complex "[1:a]volume=0.4[music];[0:a][music]sidechaincompress=threshold=0.03:ratio=3:attack=200:release=1000[aout]" \
  -map 0:v -map "[aout]" output.mp4
```

### 4. Adjust Audio Volume
```bash
# Increase volume by 50%
ffmpeg -i input.mp4 -af "volume=1.5" output.mp4

# Normalize audio
ffmpeg -i input.mp4 -af "loudnorm" output.mp4
```

### 5. Fade Audio In/Out
```bash
# Fade in 3 seconds, fade out last 3 seconds
ffmpeg -i input.mp4 -af "afade=t=in:st=0:d=3,afade=t=out:st=27:d=3" output.mp4
```

---

## Transitions

### 1. Crossfade Transition
```bash
# 2-second crossfade between two videos
ffmpeg -i video1.mp4 -i video2.mp4 \
  -filter_complex "[0:v]fade=t=out:st=8:d=2[v0]; \
                   [1:v]fade=t=in:st=0:d=2[v1]; \
                   [v0][v1]overlay[outv]; \
                   [0:a][1:a]acrossfade=d=2[outa]" \
  -map "[outv]" -map "[outa]" output.mp4
```

### 2. Fade In/Out
```bash
# Fade in first 2 seconds, fade out last 2 seconds
ffmpeg -i input.mp4 -vf "fade=t=in:st=0:d=2,fade=t=out:st=28:d=2" output.mp4
```

### 3. Crossfade Multiple Videos
```bash
# Three videos with 1.5-second crossfades
ffmpeg -i v1.mp4 -i v2.mp4 -i v3.mp4 \
  -filter_complex \
  "[0:v][0:a][1:v][1:a]xfade=transition=fade:duration=1.5:offset=8.5[vt1][at1]; \
   [vt1][at1][2:v][2:a]xfade=transition=fade:duration=1.5:offset=18[outv][outa]" \
  -map "[outv]" -map "[outa]" output.mp4
```

---

## Text Overlays

### 1. Simple Text Overlay
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='My Video Title':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.5:boxborderw=5" output.mp4
```

### 2. Text with Custom Font
```bash
ffmpeg -i input.mp4 -vf "drawtext=fontfile=/path/to/font.ttf:text='Custom Text':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" output.mp4
```

### 3. Animated Text (Scroll from Bottom)
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='Breaking News':fontsize=36:fontcolor=yellow:x=(w-text_w)/2:y=h-50*t:enable='lt(t,10)'" output.mp4
```

### 4. Text with Timestamp
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='%{pts\:hms}':fontsize=24:fontcolor=white:x=10:y=10:box=1:boxcolor=black@0.5" output.mp4
```

### 5. Lower Third Text
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='John Doe':fontsize=32:fontcolor=white:x=50:y=h-120:box=1:boxcolor=blue@0.7:boxborderw=5, \
                          drawtext=text='CEO, Company':fontsize=24:fontcolor=white:x=50:y=h-80:box=1:boxcolor=blue@0.7:boxborderw=5" output.mp4
```

---

## Video Overlays & Avatars

### 1. Picture-in-Picture (Avatar in Corner)
```bash
# Avatar in bottom-right corner
ffmpeg -i main_video.mp4 -i avatar.mp4 \
  -filter_complex "[1:v]scale=320:240[avatar];[0:v][avatar]overlay=W-w-20:H-h-20" \
  output.mp4
```

### 2. Circular Avatar Mask
```bash
# Create circular avatar
ffmpeg -i avatar.mp4 -vf "crop=min(iw\,ih):min(iw\,ih),scale=200:200,format=yuva420p,geq='lum_expr=lum(X,Y)':a_expr='if(gt(sqrt((X-W/2)^2+(Y-H/2)^2),W/2),0,255)'" avatar_circle.mp4

# Overlay circular avatar
ffmpeg -i main_video.mp4 -i avatar_circle.mp4 \
  -filter_complex "[0:v][1:v]overlay=W-w-20:20" output.mp4
```

### 3. Watermark/Logo Overlay
```bash
ffmpeg -i video.mp4 -i logo.png \
  -filter_complex "[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-10:10" \
  output.mp4
```

### 4. Split Screen (Two Videos Side by Side)
```bash
ffmpeg -i left.mp4 -i right.mp4 \
  -filter_complex "[0:v]scale=960:1080[left];[1:v]scale=960:1080[right];[left][right]hstack" \
  output.mp4
```

### 5. Green Screen Removal (Chroma Key)
```bash
ffmpeg -i avatar_greenscreen.mp4 -i background.mp4 \
  -filter_complex "[0:v]chromakey=green:0.1:0.2[ckout];[1:v][ckout]overlay=W-w-20:20" \
  output.mp4
```

---

## Visual Effects & Filters

### 1. Color Grading Presets

**Warm Tone:**
```bash
ffmpeg -i input.mp4 -vf "eq=brightness=0.05:saturation=1.2,curves=r='0/0 0.5/0.58 1/1':g='0/0 0.5/0.5 1/1':b='0/0 0.5/0.4 1/1'" output.mp4
```

**Cool Tone:**
```bash
ffmpeg -i input.mp4 -vf "eq=saturation=1.1,curves=r='0/0 0.5/0.45 1/1':g='0/0 0.5/0.5 1/1':b='0/0 0.5/0.6 1/1'" output.mp4
```

**Vibrant:**
```bash
ffmpeg -i input.mp4 -vf "eq=contrast=1.2:saturation=1.5:brightness=0.02" output.mp4
```

### 2. Black & White
```bash
ffmpeg -i input.mp4 -vf "hue=s=0" output.mp4
```

### 3. Sepia Tone
```bash
ffmpeg -i input.mp4 -vf "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131" output.mp4
```

### 4. Blur Effect
```bash
# Gaussian blur
ffmpeg -i input.mp4 -vf "gblur=sigma=5" output.mp4

# Background blur with sharp foreground (portrait mode effect)
ffmpeg -i input.mp4 -vf "split[original][blurred];[blurred]gblur=sigma=10[blurred];[blurred][original]overlay" output.mp4
```

### 5. Sharpen
```bash
ffmpeg -i input.mp4 -vf "unsharp=5:5:1.0:5:5:0.0" output.mp4
```

### 6. Vignette Effect
```bash
ffmpeg -i input.mp4 -vf "vignette=PI/4" output.mp4
```

---

## Templates & Branding

### 1. Add Intro/Outro
```bash
# Create filelist with intro, main content, outro
cat > filelist.txt << EOF
file 'intro.mp4'
file 'main_video.mp4'
file 'outro.mp4'
EOF

ffmpeg -f concat -safe 0 -i filelist.txt -c copy final.mp4
```

### 2. Animated Title Card
```bash
# Create a 5-second title card with fade
ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=5 \
  -vf "drawtext=text='My Amazing Video':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2,fade=t=in:st=0:d=1,fade=t=out:st=4:d=1" \
  title_card.mp4
```

### 3. Custom Border/Frame
```bash
ffmpeg -i input.mp4 -vf "pad=width=1920+20:height=1080+20:x=10:y=10:color=white" output.mp4
```

---

## AWS Lambda Implementation

### Node.js Lambda Handler Example

```javascript
const { spawn } = require('child_process');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const s3 = new AWS.S3();

exports.handler = async (event) => {
  const { videos, music, transitions, outputKey } = JSON.parse(event.body);
  
  try {
    // Download videos from S3 to /tmp
    const localVideos = await Promise.all(
      videos.map(async (video, idx) => {
        const params = { Bucket: video.bucket, Key: video.key };
        const data = await s3.getObject(params).promise();
        const localPath = `/tmp/video_${idx}.mp4`;
        fs.writeFileSync(localPath, data.Body);
        return localPath;
      })
    );
    
    // Download music if provided
    let musicPath = null;
    if (music) {
      const musicData = await s3.getObject({ Bucket: music.bucket, Key: music.key }).promise();
      musicPath = '/tmp/music.mp3';
      fs.writeFileSync(musicPath, musicData.Body);
    }
    
    // Build ffmpeg command
    const outputPath = '/tmp/output.mp4';
    const ffmpegArgs = await buildFfmpegCommand({
      videos: localVideos,
      music: musicPath,
      transitions,
      output: outputPath
    });
    
    // Execute ffmpeg
    await runFfmpeg(ffmpegArgs);
    
    // Upload result to S3
    const outputData = fs.readFileSync(outputPath);
    await s3.putObject({
      Bucket: process.env.OUTPUT_BUCKET,
      Key: outputKey,
      Body: outputData,
      ContentType: 'video/mp4'
    }).promise();
    
    // Cleanup
    fs.unlinkSync(outputPath);
    localVideos.forEach(f => fs.unlinkSync(f));
    if (musicPath) fs.unlinkSync(musicPath);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Video processed successfully',
        outputKey 
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function buildFfmpegCommand({ videos, music, transitions, output }) {
  // Build filter complex for concatenation with crossfades
  let filterComplex = '';
  let inputs = [];
  
  videos.forEach((video, idx) => {
    inputs.push('-i', video);
    filterComplex += `[${idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${idx}];`;
  });
  
  if (music) {
    inputs.push('-i', music);
  }
  
  // Build concatenation
  let concatInputs = '';
  videos.forEach((_, idx) => concatInputs += `[v${idx}][${idx}:a]`);
  filterComplex += `${concatInputs}concat=n=${videos.length}:v=1:a=1[vout][aout]`;
  
  let args = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-y',
    output
  ];
  
  return args;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('/opt/bin/ffmpeg', args);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}
```

### Python Lambda Handler Example

```python
import boto3
import subprocess
import os
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        videos = body['videos']
        music = body.get('music')
        avatar = body.get('avatar')
        text_overlays = body.get('textOverlays', [])
        output_key = body['outputKey']
        
        # Download videos
        local_videos = []
        for idx, video in enumerate(videos):
            local_path = f'/tmp/video_{idx}.mp4'
            s3.download_file(video['bucket'], video['key'], local_path)
            local_videos.append(local_path)
        
        # Download music if provided
        music_path = None
        if music:
            music_path = '/tmp/music.mp3'
            s3.download_file(music['bucket'], music['key'], music_path)
        
        # Download avatar if provided
        avatar_path = None
        if avatar:
            avatar_path = '/tmp/avatar.mp4'
            s3.download_file(avatar['bucket'], avatar['key'], avatar_path)
        
        # Build and run ffmpeg command
        output_path = '/tmp/output.mp4'
        cmd = build_ffmpeg_command(
            videos=local_videos,
            music=music_path,
            avatar=avatar_path,
            text_overlays=text_overlays,
            output=output_path
        )
        
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"ffmpeg error: {result.stderr}")
            raise Exception(f"ffmpeg failed: {result.stderr}")
        
        # Upload result
        s3.upload_file(
            output_path,
            os.environ['OUTPUT_BUCKET'],
            output_key,
            ExtraArgs={'ContentType': 'video/mp4'}
        )
        
        # Cleanup
        os.remove(output_path)
        for video in local_videos:
            os.remove(video)
        if music_path:
            os.remove(music_path)
        if avatar_path:
            os.remove(avatar_path)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Video processed successfully',
                'outputKey': output_key
            })
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def build_ffmpeg_command(videos, music, avatar, text_overlays, output):
    cmd = ['/opt/bin/ffmpeg']
    
    # Add input videos
    for video in videos:
        cmd.extend(['-i', video])
    
    # Add music input
    if music:
        cmd.extend(['-i', music])
    
    # Add avatar input
    if avatar:
        cmd.extend(['-i', avatar])
    
    # Build filter complex
    filter_parts = []
    
    # Scale and pad all videos
    for idx in range(len(videos)):
        filter_parts.append(
            f"[{idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
            f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v{idx}]"
        )
    
    # Concatenate videos
    concat_inputs = ''.join([f"[v{i}][{i}:a]" for i in range(len(videos))])
    filter_parts.append(
        f"{concat_inputs}concat=n={len(videos)}:v=1:a=1[vconcat][aconcat]"
    )
    
    # Add avatar overlay if provided
    if avatar:
        avatar_idx = len(videos) + (1 if music else 0)
        filter_parts.append(
            f"[{avatar_idx}:v]scale=320:240[avatar]"
        )
        filter_parts.append(
            f"[vconcat][avatar]overlay=W-w-20:20[vout]"
        )
        video_output = "[vout]"
    else:
        video_output = "[vconcat]"
    
    # Add text overlays
    if text_overlays:
        current_input = video_output.strip('[]')
        for idx, text in enumerate(text_overlays):
            text_filter = (
                f"drawtext=text='{text['text']}':fontsize={text.get('fontSize', 48)}:"
                f"fontcolor={text.get('color', 'white')}:x={text.get('x', '(w-text_w)/2')}:"
                f"y={text.get('y', 50)}"
            )
            if idx == len(text_overlays) - 1:
                filter_parts.append(f"[{current_input}]{text_filter}[vfinal]")
                video_output = "[vfinal]"
            else:
                filter_parts.append(f"[{current_input}]{text_filter}[vtext{idx}]")
                current_input = f"vtext{idx}"
    
    # Mix audio with music if provided
    if music:
        music_idx = len(videos)
        filter_parts.append(
            f"[{music_idx}:a]volume=0.3[music]"
        )
        filter_parts.append(
            f"[aconcat][music]amix=inputs=2:duration=shortest[aout]"
        )
        audio_output = "[aout]"
    else:
        audio_output = "[aconcat]"
    
    # Add filter complex
    cmd.extend(['-filter_complex', ';'.join(filter_parts)])
    
    # Map outputs
    cmd.extend(['-map', video_output])
    cmd.extend(['-map', audio_output])
    
    # Output settings
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        output
    ])
    
    return cmd
```

### Lambda Layer Setup for FFmpeg

```bash
# Create a Lambda layer with ffmpeg
mkdir -p ffmpeg-layer/bin
cd ffmpeg-layer

# Download static ffmpeg build
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xvf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-amd64-static/ffmpeg bin/
cp ffmpeg-*-amd64-static/ffprobe bin/

# Create layer zip
cd ..
zip -r ffmpeg-layer.zip ffmpeg-layer

# Upload to AWS Lambda Layer
aws lambda publish-layer-version \
  --layer-name ffmpeg \
  --zip-file fileb://ffmpeg-layer.zip \
  --compatible-runtimes python3.9 python3.10 nodejs18.x nodejs20.x
```

---

## Complete Workflow Examples

### Example 1: Simple Video Merger with Music

```bash
# Merge 3 videos, add background music, add title
ffmpeg -i video1.mp4 -i video2.mp4 -i video3.mp4 -i music.mp3 \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0]; \
   [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1]; \
   [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v2]; \
   [v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[vout][aout]; \
   [vout]drawtext=text='My Video Collection':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.7:boxborderw=5[vfinal]; \
   [3:a]volume=0.3[music]; \
   [aout][music]amix=inputs=2:duration=shortest[afinal]" \
  -map "[vfinal]" -map "[afinal]" \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  output.mp4
```

### Example 2: Video with Avatar and Lower Third

```bash
# Main video + circular avatar + lower third text
ffmpeg -i main.mp4 -i avatar.mp4 \
  -filter_complex \
  "[1:v]scale=200:200,format=yuva420p,geq='lum_expr=lum(X,Y)':a_expr='if(gt(sqrt((X-W/2)^2+(Y-H/2)^2),W/2),0,255)'[avatar]; \
   [0:v][avatar]overlay=W-w-30:30[vavatar]; \
   [vavatar]drawtext=text='Jane Smith':fontsize=36:fontcolor=white:x=50:y=h-120:box=1:boxcolor=0x0080FF@0.8:boxborderw=5[vname]; \
   [vname]drawtext=text='Marketing Director':fontsize=24:fontcolor=white:x=50:y=h-75:box=1:boxcolor=0x0080FF@0.8:boxborderw=5[vfinal]" \
  -map "[vfinal]" -map 0:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac \
  output.mp4
```

### Example 3: Full Production with Intro, Content, Outro

```bash
# Step 1: Create intro card
ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=3 \
  -vf "drawtext=text='Welcome to':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=400,\
       drawtext=text='My Channel':fontsize=72:fontcolor=#FF6B35:x=(w-text_w)/2:y=500,\
       fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5" \
  -c:v libx264 intro.mp4

# Step 2: Process main content with effects
ffmpeg -i main_content.mp4 -i logo.png \
  -filter_complex \
  "[0:v]eq=contrast=1.1:saturation=1.2[enhanced]; \
   [1:v]scale=100:-1[logo]; \
   [enhanced][logo]overlay=W-w-20:20[vout]" \
  -map "[vout]" -map 0:a \
  -c:v libx264 -preset fast -crf 23 \
  main_enhanced.mp4

# Step 3: Create outro card
ffmpeg -f lavfi -i color=c=#1a1a1a:s=1920x1080:d=5 \
  -vf "drawtext=text='Subscribe for More!':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=400,\
       drawtext=text='Thanks for Watching':fontsize=36:fontcolor=gray:x=(w-text_w)/2:y=600,\
       fade=t=in:st=0:d=0.5" \
  -c:v libx264 outro.mp4

# Step 4: Concatenate all parts
cat > final_list.txt << EOF
file 'intro.mp4'
file 'main_enhanced.mp4'
file 'outro.mp4'
EOF

ffmpeg -f concat -safe 0 -i final_list.txt -c copy final_video.mp4
```

### Example 4: Social Media Multi-Format Export

```bash
# Source video
SOURCE="input.mp4"

# YouTube (16:9, 1080p)
ffmpeg -i $SOURCE \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080