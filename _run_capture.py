import subprocess
import sys
import time
import os

def run():
    print("Running npm run dev for a few seconds to capture the crash...")
    try:
        process = subprocess.Popen(
            'npm run dev',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            cwd=r'd:\新建文件夹\bg\jizhang'
        )
        
        # Wait up to 5 seconds to see if it crashes
        try:
            stdout, stderr = process.communicate(timeout=5)
            print("STDOUT:")
            print(stdout)
            print("STDERR:")
            print(stderr)
        except subprocess.TimeoutExpired:
            print("Process did not crash within 5 seconds. Killing it.")
            process.kill()
            stdout, stderr = process.communicate()
            print("STDOUT:")
            print(stdout)
            print("STDERR:")
            print(stderr)
            
        return process.returncode
    except Exception as e:
        print(f"Error starting process: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(run())
