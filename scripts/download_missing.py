import json
import os
import urllib.request
import subprocess

def download_file(url, filepath):
    try:
        urllib.request.urlretrieve(url, filepath)
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def fix_all():
    with open('src/app/data/creators.json', 'r', encoding='utf-8') as f:
        creators = json.load(f)

    updated = False
    
    for c in creators:
        if not c.get('reels') or not c['reels']: continue
        video_url = c['reels'][0].get('videoUrl', '')
        if 'instagram.com' in video_url:
            handle = c['handle']
            print(f"Fixing {handle} with url: {video_url}")
            
            # If it's a direct mp4, just download it
            if '.mp4' in video_url:
                filename = f"reel_{handle}.mp4"
                filepath = os.path.join('public', 'videos', filename)
                print(f"Downloading direct mp4 to {filepath}")
                if download_file(video_url, filepath):
                    c['reels'][0]['videoUrl'] = filename
                    updated = True
            
            # If it's a reel webpage URL like riddhiimaa
            elif '/reel/' in video_url or '/p/' in video_url:
                shortcode = video_url.split('/reel/')[-1].split('/')[0]
                if '?igsh' in shortcode:
                    shortcode = shortcode.split('?')[0]
                if shortcode == video_url: # maybe it was /p/
                    shortcode = video_url.split('/p/')[-1].split('/')[0]
                
                print(f"Trying instaloader for {shortcode}")
                try:
                    # Instaloader usage to just download the post
                    cmd = [os.path.expanduser('~\\AppData\\Roaming\\Python\\Python314\\Scripts\\instaloader.exe'), '--no-metadata-json', '--no-captions', '--no-compress-json', '--post-filter=is_video', f'-{'post'}', shortcode]
                    subprocess.run(cmd, check=True)
                    
                    # find the mp4 file downloaded in the folder
                    downloaded_dir = f"-{shortcode}"
                    if os.path.isdir(downloaded_dir):
                        for f_name in os.listdir(downloaded_dir):
                            if f_name.endswith('.mp4'):
                                src = os.path.join(downloaded_dir, f_name)
                                dst_filename = f"reel_{shortcode}.mp4"
                                dst = os.path.join('public', 'videos', dst_filename)
                                os.rename(src, dst)
                                c['reels'][0]['videoUrl'] = dst_filename
                                updated = True
                                print(f"Successfully downloaded {dst_filename}")
                                break
                except Exception as e:
                    print(f"Instaloader error: {e}")
                    
    if updated:
        with open('src/app/data/creators.json', 'w', encoding='utf-8') as f:
            json.dump(creators, f, indent=2, ensure_ascii=False)
        print("Updated creators.json")

if __name__ == '__main__':
    fix_all()
