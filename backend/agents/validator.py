from typing import Optional

SEMESTER_ORDER = ['Fall 2026', 'Spring 2027', 'Fall 2027', 'Spring 2028']

SPRING_ONLY = {'CMSC 441', 'CMSC 448'}
FALL_ONLY = {'CMSC 447'}

CREDIT_WARN_LIMIT = 19.5


def _semester_index(sem: str) -> int:
    try:
        return SEMESTER_ORDER.index(sem)
    except ValueError:
        return -1


def validate_placement(
    course_code: str,
    target_semester: str,
    current_plan: dict,
    completed_courses: list,
    all_courses: list,
) -> dict:
    errors = []
    warnings = []

    course = next((c for c in all_courses if c['id'] == course_code), None)
    if not course:
        return {'valid': False, 'errors': [f'{course_code} not found in audit'], 'warnings': []}

    sem_lower = target_semester.lower()

    # 1. Semester constraint
    if course_code in SPRING_ONLY and 'fall' in sem_lower:
        errors.append(f'{course_code} is Spring-only — cannot place in {target_semester}')

    if course_code in FALL_ONLY and 'spring' in sem_lower:
        errors.append(f'{course_code} is Fall-only — cannot place in {target_semester}')

    # Also check spring_only flag from audit data
    if course.get('spring_only') and 'fall' in sem_lower:
        msg = f'{course_code} is Spring-only — cannot place in {target_semester}'
        if msg not in errors:
            errors.append(msg)

    # 2. Prereq ordering
    target_idx = _semester_index(target_semester)
    for prereq_id in course.get('prereqs', []):
        if prereq_id in completed_courses:
            continue
        placed_in = next(
            (sem for sem, codes in current_plan.items() if prereq_id in codes),
            None
        )
        if placed_in is None:
            errors.append(f'Prereq {prereq_id} is not completed or planned — place it first')
        elif _semester_index(placed_in) >= target_idx:
            errors.append(f'Prereq {prereq_id} must come before {target_semester}')

    # 3. Credit load warning
    placed_codes = current_plan.get(target_semester, [])
    current_credits = sum(
        next((c.get('credits', 3) for c in all_courses if c['id'] == code), 3)
        for code in placed_codes
    )
    new_total = current_credits + course.get('credits', 3)
    if new_total > CREDIT_WARN_LIMIT:
        warnings.append(
            f'{target_semester} would reach {new_total} credits — heavy load (limit ~19.5)'
        )

    return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}
