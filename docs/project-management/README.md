# Project Management System

## 📋 Overview

Структурированная система управления задачами для AI QA Sentinel проекта, обеспечивающая прозрачность прогресса и эффективное планирование.

## 📁 File Structure

```
docs/project-management/
├── README.md           # This file - system overview
├── tasks-overview.md   # High-level project status dashboard
├── current-sprint.md   # Active sprint tasks and progress
├── backlog.md         # All planned tasks with micro-task breakdown
├── completed.md       # Completed tasks with analytics
└── paused.md          # Tasks on hold with reasons
```

## 🔄 Workflow

### For Development Sessions
1. **Start session:** Check `current-sprint.md` for active tasks
2. **Begin task:** Update status to "in_progress"
3. **Complete task:** Move to `completed.md` with timing data
4. **Plan next:** Review `backlog.md` for next priority

### For Sprint Planning
1. **Review progress:** Check `tasks-overview.md` dashboard
2. **Plan sprint:** Select tasks from `backlog.md`
3. **Update sprint:** Modify `current-sprint.md`
4. **Track completion:** Monitor daily progress

### For Task Management
1. **New tasks:** Add to `backlog.md` with proper breakdown
2. **Task changes:** Update all relevant files
3. **Blockers:** Move to `paused.md` with clear reasons
4. **Dependencies:** Document in task descriptions

## 📊 Task Status Definitions

### Status Types
- **✅ Completed:** Task fully finished, tested, and documented
- **🟡 In Progress:** Currently being worked on
- **⏸️ Pending:** Ready to start, all dependencies met
- **🚫 Blocked:** Cannot proceed due to external factors
- **❌ Cancelled:** No longer needed or scope changed

### Task Priorities
- **Critical:** Must complete for project success
- **High:** Important for core functionality
- **Medium:** Enhances user experience
- **Low:** Nice-to-have features

## 🎯 Micro-Task Guidelines

### Size Requirements
- **Maximum:** 4 hours per task
- **Optimal:** 1-2 hours per task
- **Minimum:** 30 minutes per task

### Breakdown Rules
1. Each task should have clear start/end conditions
2. Dependencies must be explicitly defined
3. Acceptance criteria must be testable
4. Technical notes should reference documentation

### Quality Standards
- All tasks must have time estimates
- Acceptance criteria must be specific
- Technical dependencies documented
- Risk factors identified

## 📈 Progress Tracking

### Daily Updates
```markdown
## Daily Progress (YYYY-MM-DD)
- **Completed:** [Task name] - [Duration]
- **Started:** [Task name] - [Progress %]
- **Blocked:** [Task name] - [Blocker reason]
- **Next:** [Planned task] - [Start time]
```

### Weekly Reviews
1. **Progress assessment:** Completed vs planned
2. **Estimation accuracy:** Actual vs estimated times
3. **Blocker analysis:** Root causes and solutions
4. **Velocity calculation:** Tasks per week trend

## 🔧 Tools Integration

### With CLAUDE.md
- Task context automatically available
- Technical standards applied consistently
- Architecture decisions referenced properly

### With Documentation
- Backend guidelines inform task breakdown
- Performance requirements drive priorities
- Deployment procedures validate completion

## 📝 Task Template

```markdown
#### Task [ID]: [Task Name]
- **Epic:** [Epic Name]
- **Priority:** [Critical/High/Medium/Low]
- **Estimated:** [X hours]
- **Dependencies:** [List dependencies]
- **Description:** [Clear task description]

**Micro-task Breakdown:** (if > 2 hours)
- **[ID].1:** [Subtask] ([time]h)
- **[ID].2:** [Subtask] ([time]h)

**Acceptance Criteria:**
- [Testable criterion 1]
- [Testable criterion 2]

**Technical Notes:** [References to docs/code]
```

## 🚨 Emergency Procedures

### Critical Task Blocking
1. Document blocker in `paused.md`
2. Identify alternative tasks from backlog
3. Update sprint plan immediately
4. Notify stakeholders of impact

### Scope Changes
1. Update affected tasks in backlog
2. Reassess priorities and estimates
3. Document decision rationale
4. Update project timeline

## 📊 Metrics Tracking

### Velocity Metrics
- **Tasks completed per week**
- **Average task duration**
- **Estimation accuracy percentage**
- **Rework frequency**

### Quality Metrics
- **Tasks completed without rework**
- **Blocked task percentage**
- **Documentation completeness**
- **Code review feedback volume**

## 🔄 Continuous Improvement

### Weekly Retrospectives
1. **What went well:** Successful patterns
2. **What could improve:** Pain points identified
3. **Action items:** Specific improvements
4. **Process updates:** System refinements

### Monthly Reviews
1. **Velocity trends:** Speed improvements
2. **Quality trends:** Defect rates
3. **Process effectiveness:** System utility
4. **Tool optimization:** Workflow improvements

---

**Last Updated:** 2024-09-23
**System Version:** 1.0
**Maintenance Schedule:** Weekly reviews, monthly optimizations