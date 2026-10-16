"""Build the selected exercise into the workspace's shared, replaceable cache."""
from pathlib import Path
import argparse
import os
import subprocess
import sys
import uuid


def build(compiler, sources, output):
    output = Path(output).resolve()
    output.unlink(missing_ok=True)
    sources = [Path(p).resolve(strict=True) for p in sources]
    output.parent.mkdir(parents=True, exist_ok=True)
    # Relative arguments also work with MinGW tools that cannot decode Chinese paths.
    cwd = sources[0].parent
    temporary = output.with_name('build-' + uuid.uuid4().hex + '.exe')
    args = [str(compiler), '-std=c++20', '-Wall', '-Wextra', '-Wpedantic', '-g',
            '-Wl,--discard-all', *(os.path.relpath(p, cwd) for p in sources),
            '-o', os.path.relpath(temporary, cwd)]
    try:
        result = subprocess.run(args, cwd=cwd)
        if result.returncode:
            # A failed build must not leave an older executable available for launch.
            output.unlink(missing_ok=True)
            return result.returncode
        os.replace(temporary, output)
        return 0
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('sources', nargs='+')
    args = parser.parse_args()
    try:
        sys.exit(build(args.compiler, args.sources, args.output))
    except (OSError, ValueError) as error:
        print('C++ build failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
