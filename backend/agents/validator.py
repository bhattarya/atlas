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

    # Season-only conflicts → soft warning, not a hard error
    if course_code in SPRING_ONLY and 'fall' in sem_lower:
        warnings.append(f'{course_code} is typically offered Spring only — confirm a Fall section exists before relying on this slot')

    if course_code in FALL_ONLY and 'spring' in sem_lower:
        warnings.append(f'{course_code} is typically offered Fall only — confirm a Spring section exists before relying on this slot')

    if course.get('spring_only') and 'fall' in sem_lower:
        msg = f'{course_code} is typically offered Spring only — confirm a Fall section exists before relying on this slot'
        if msg not in warnings:
            warnings.append(msg)

    # Prereq issues → soft warning with grade reminder
    target_idx = _semester_index(target_semester)
    for prereq_id in course.get('prereqs', []):
        if prereq_id in completed_courses:
            continue
        placed_in = next(
            (sem for sem, codes in current_plan.items() if prereq_id in codes), None
        )
        if placed_in is None:
            warnings.append(f'You still need to pass {prereq_id} (with C or better) before taking {course_code}')
        elif _semester_index(placed_in) >= target_idx:
            warnings.append(f'{prereq_id} is planned for {placed_in} — finish it (C or better) before {course_code} in {target_semester}')

    # Heavy load warning
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

    # Always "valid" — placement is allowed; the warnings convey concerns
    return {'valid': True, 'errors': [], 'warnings': warnings}
