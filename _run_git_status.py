import subprocess
import sys

def run():
    print("--- Git Status ---")
    result1 = subprocess.run(['git', 'status'], capture_output=True, text=True, check=False)
    print(result1.stdout)
    if result1.stderr:
        print(result1.stderr)
        
    print("--- Git Remote ---")
    result2 = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True, check=False)
    print(result2.stdout)
    if result2.stderr:
        print(result2.stderr)
        
    return 0

if __name__ == "__main__":
    sys.exit(run())
