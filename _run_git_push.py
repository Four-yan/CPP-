import subprocess
import sys

COMMANDS = [
    ['git', 'add', '.'],
    ['git', 'commit', '-m', 'Fix vite-plugin-pwa injectManifest configuration'],
    ['git', 'push', 'origin', 'main']
]

def run():
    for i, cmd in enumerate(COMMANDS):
        print(f"[{i+1}/{len(COMMANDS)}] 执行: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=False, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        if result.returncode != 0:
            print(f"命令失败，退出码: {result.returncode}")
            return result.returncode
    return 0

if __name__ == "__main__":
    sys.exit(run())
