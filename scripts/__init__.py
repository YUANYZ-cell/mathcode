"""Development helpers; all test scratch files stay in the ignored local folder."""
from pathlib import Path
(Path(__file__).resolve().parents[1] / '.local').mkdir(exist_ok=True)
