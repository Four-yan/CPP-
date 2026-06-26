import subprocess
import sys

def run():
    print("Running npm run build to check for actual errors...")
    result = subprocess.run(
        'npm run build',
        shell=True,
        check=False,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)
    return result.returncode

if __name__ == "__main__":
    sys.exit(run())
