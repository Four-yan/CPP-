import subprocess
import sys

def run():
    print("Running npm run build...")
    result = subprocess.run(['npm', 'run', 'build'], check=False, capture_output=True, text=True, shell=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"命令失败，退出码: {result.returncode}")
        return result.returncode
    print("Build successful.")
    return 0

if __name__ == "__main__":
    sys.exit(run())
