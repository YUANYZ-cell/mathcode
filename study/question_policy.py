"""Keep reviewed course instructions separate from concrete exercises."""
from __future__ import annotations

import copy
import re


GENERAL_REQUIREMENT = re.compile(
    r'(?:\d+\.\s*)?Solve all the self-practice questions, case studies and '
    r'example codes provided in the lecture note\.', re.I)
COURSE_CLOSING = re.compile(
    r'If you have finished all the questions above, feel free to learn more '
    r'about C from online\s+resources\.'
    r'(?:\s+(?:Preparation for next lecture will be a good choice as well\.'
    r'|Or, if you like, ask me for extra exercise questions\.'
    r'|If you are interested, you can email me to get extra exercise questions?\.))?',
    re.I)


def prepare_question(title, payload):
    """Apply only exact reviewed prose rules; referring to another task is valid.

    Source documents and the archival answer collection remain untouched.
    A stable item may change kind so existing records and code keep their IDs.
    """
    original = payload.get('question_md', '')
    normalized = ' '.join(original.split())
    if GENERAL_REQUIREMENT.fullmatch(normalized):
        return 'guidance', '课内学习安排', {
            'question_md': original,
            'question_format': payload.get('question_format', 'plain'),
            'question_images': [],
            'references': [r for r in payload.get('references', []) if r.get('role') != 'answer'],
            'classification_note': '整章学习要求，没有独立题干；不作为题目，不附参考答案或代码。',
        }
    # Only remove the reviewed course closing, not the optional pattern task
    # in C-S3-30 or any figures following the closing in PDF text order.
    cleaned, count = COURSE_CLOSING.subn('', original)
    if count:
        result = copy.deepcopy(payload)
        result['question_md'] = cleaned.rstrip()
        result['original_question_md'] = original
        result['course_guidance'] = [m.group(0) for m in COURSE_CLOSING.finditer(original)]
        return 'question', title, result
    return 'question', title, payload
