"""Build and explicitly run one learner-selected C++ file from its own folder."""
from pathlib import Path
import argparse
import subprocess
import sys
from build_cpp import build


def run(source, compiler, output):
    source = Path(source).resolve(strict=True)
    if source.suffix.lower() not in {'.cpp', '.cc', '.cxx'}:
        raise ValueError('Select a saved C++ source file before running.')
    output = Path(output).resolve()
    result = build(compiler, [source], output)
    if result:
        return result
    print('Run directory: ' + str(source.parent), flush=True)
    # Inherit the integrated terminal for interactive cin, including Ctrl+C.
    return subprocess.call([str(output)], cwd=source.parent)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', default=str(Path.home()/'.local/w64devkit/bin/g++.exe'))
    parser.add_argument('--output', required=True)
    parser.add_argument('source')
    args = parser.parse_args()
    try:
        sys.exit(run(args.source, args.compiler, args.output))
    except (OSError, ValueError) as error:
        print('C++ run failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
