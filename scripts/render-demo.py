"""Render the narrated demo from real browser captures. Requires macOS say and ffmpeg."""
import concurrent.futures
import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/private/tmp/noticebridge-demo/render')
WORK.mkdir(parents=True, exist_ok=True)
SCENES = json.loads((ROOT / 'demo/storyboard.json').read_text())
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
INK, PAPER, RED = '0x1d3e59', '0xeee8dc', '0xb6432f'

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)]))

def prepare(pair):
    index, scene = pair
    prefix = WORK / f'{index:02d}'
    narration = prefix.with_suffix('.txt')
    narration.write_text(scene['narration'])
    voice = prefix.with_suffix('.aiff')
    run(['say','-v','Daniel','-r','178','-f',str(narration),'-o',str(voice)])
    return round(duration(voice) + 0.8, 3)

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    lengths = list(pool.map(prepare, enumerate(SCENES, 1)))
print(f'Narration ready. Runtime: {sum(lengths):.1f} seconds.', flush=True)
if not 60 <= sum(lengths) <= 180:
    raise ValueError('The submission demo must be 1–3 minutes long.')

def text_filter(text, filename, x, y, size, color=INK, font=FONT, spacing=10):
    path = WORK / filename
    path.write_text(text)
    return f"drawtext=fontfile='{font}':textfile='{path}':expansion=none:x={x}:y={y}:fontsize={size}:fontcolor={color}:line_spacing={spacing}"

def render(pair):
    index, scene = pair
    length = lengths[index-1]
    prefix = WORK / f'{index:02d}'
    image = ROOT / 'demo/frames' / scene['image']
    filters = [
        f'[0:v]scale=760:842:flags=lanczos,setsar=1[shot]',
        f'color=c={PAPER}:s=1920x1080:r=30:d={length}[paper]',
        '[paper]drawbox=x=988:y=98:w=780:h=862:color=0x1d3e5920:t=fill[shadow]',
        '[shadow][shot]overlay=998:108[screen]',
    ]
    decor = [
        f'drawbox=x=84:y=94:w=810:h=3:color={INK}:t=fill',
        text_filter('NOTICEBRIDGE    /    SCHOOL TO HOME',f'{index}-brand.txt',84,50,25),
        text_filter(scene['label'],f'{index}-label.txt',88,155,24,RED),
        text_filter(scene['title'],f'{index}-title.txt',84,225,76,font=BOLD,spacing=5),
        text_filter(scene['body'],f'{index}-body.txt',88,530,31,spacing=12),
        f'drawbox=x=84:y=823:w=810:h=92:color=0xf0d581:t=fill',
        text_filter(scene['note'],f'{index}-note.txt',108,855,27),
        text_filter(f'LOCAL PROTOTYPE WALKTHROUGH     {index:02d} / {len(SCENES):02d}',f'{index}-footer.txt',88,940,20),
        f'drawbox=x=0:y=996:w=1920:h=84:color={INK}:t=fill',
    ]
    filters.append('[screen]' + ','.join(decor) + '[v]')
    output = prefix.with_suffix('.mp4')
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1','-framerate','30','-i',str(image),
         '-i',str(prefix.with_suffix('.aiff')),'-filter_complex',';'.join(filters),'-map','[v]','-map','1:a',
         '-af','adelay=250|250,apad,loudnorm=I=-16:TP=-1.5:LRA=11','-t',str(length),
         '-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-threads','2',
         '-c:a','aac','-b:a','160k','-ar','48000',str(output)])
    print(f'Scene {index:02d} rendered.', flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(render, enumerate(SCENES, 1)))

def stamp(seconds):
    ms = round(seconds*1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'

captions = []
time = 0.0
transcript = ['# NoticeBridge demo', '', 'Narrated walkthrough using actual browser captures and the fictional museum-trip sample.', '']
for index, (scene, length) in enumerate(zip(SCENES,lengths), 1):
    transcript.extend([f"## {stamp(time).split(',')[0]} — {scene['label'].split(' / ',1)[1]}", '', scene['narration'], ''])
    words = scene['narration'].split()
    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(' '.join(current)) >= 105:
            chunks.append(current); current=[]
    if current: chunks.append(current)
    position = time + .25
    speech_length = length-.8
    for chunk in chunks:
        span = speech_length * len(chunk)/len(words)
        captions.extend([str(len(captions)//4+1), f'{stamp(position)} --> {stamp(position+span)}', '\n'.join(textwrap.wrap(' '.join(chunk),92)), ''])
        position += span
    time += length
(ROOT / 'demo/noticebridge-demo.srt').write_text('\n'.join(captions))
(ROOT / 'demo/transcript.md').write_text('\n'.join(transcript))
concat = WORK/'concat.txt'
concat.write_text('\n'.join(f"file '{WORK / f'{i:02d}.mp4'}'" for i in range(1,len(SCENES)+1)))
joined = WORK/'joined.mp4'
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(joined)])
subtitle = ROOT / 'demo/noticebridge-demo.srt'
output = ROOT / 'demo/noticebridge-demo.mp4'
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(joined),'-i',str(subtitle),
     '-vf',f"subtitles='{subtitle}':force_style='FontName=Arial,FontSize=8,PrimaryColour=&H00FFFFFF,Outline=0,Shadow=0,MarginV=3,Alignment=2'",
     '-map','0:v','-map','0:a','-map','1:0','-c:v','libx264','-preset','fast','-crf','20',
     '-c:a','copy','-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',str(output)])
print(f'Done: {output} ({duration(output):.1f}s)', flush=True)
