// Fallback static course data — used when backend is unavailable
export const FALLBACK_MAP = {
  student_name: 'Demo Student',
  major: 'CS',
  minor: null,
  credits_remaining: 30,
  completed: 18,
  bottlenecks: ['CMSC 441'],
  courses: [
    { id: 'CMSC 201', name: 'Intro Programming', credits: 4, status: 'completed', prereqs: [], level: 2 },
    { id: 'CMSC 202', name: 'Object-Oriented Prog', credits: 4, status: 'completed', prereqs: ['CMSC 201'], level: 2 },
    { id: 'CMSC 203', name: 'Discrete Structures', credits: 3, status: 'completed', prereqs: [], level: 2 },
    { id: 'CMSC 313', name: 'Assembly & OS', credits: 3, status: 'needed', prereqs: ['CMSC 202'], level: 3 },
    { id: 'CMSC 331', name: 'Principles of PL', credits: 3, status: 'needed', prereqs: ['CMSC 202'], level: 3 },
    { id: 'CMSC 341', name: 'Data Structures', credits: 3, status: 'in_progress', prereqs: ['CMSC 202', 'CMSC 203'], level: 3 },
    { id: 'CMSC 411', name: 'Computer Architecture', credits: 3, status: 'needed', prereqs: ['CMSC 313', 'CMSC 341'], level: 4, spring_only: false },
    { id: 'CMSC 441', name: 'Design & Analysis of Algorithms', credits: 3, status: 'needed', prereqs: ['CMSC 341', 'CMSC 203'], level: 4, is_bottleneck: true, spring_only: true,
      sections: [
        { section: '01', days: 'MWF', time: '9:00–9:50', seats: 0 },
        { section: '02', days: 'TuTh', time: '11:30–12:45', seats: 5 },
      ]
    },
    { id: 'CMSC 447', name: 'Software Engineering', credits: 3, status: 'needed', prereqs: ['CMSC 341'], level: 4 },
  ],
}
