# Student Dashboard Consolidated Handoff

This folder contains the student dashboard code extracted from the active `dashboard` app.

## Included

- `dashboard/src/pages/student/*` (all student pages)
- Student dependencies used by those pages:
  - `dashboard/src/components/layout/*`
  - `dashboard/src/components/dashboard/*` (used by student pages)
  - `dashboard/src/components/ui/*`
  - `dashboard/src/contexts/AuthContext.tsx`
  - `dashboard/src/hooks/use-toast.ts`
  - `dashboard/src/lib/backendApi.ts`
  - `dashboard/src/lib/utils.ts`
  - `dashboard/src/types/index.ts`
  - `dashboard/src/App.tsx` (routing reference)
  - `dashboard/tsconfig.json`, `dashboard/tsconfig.app.json`, `dashboard/components.json`, `dashboard/package.json`

## Current Student Flow State

- Web exam-taking flow is removed from active routes.
- Student exam actions are set to download the desktop exam application.
- Route entries for `/student/system-check`, `/student/exam-attempt`, and `/student/exam-submitted` are removed in `dashboard/src/App.tsx`.

## Environment Variable

Set this for the download button:

- `VITE_EXAM_APPLICATION_DOWNLOAD_URL=https://your-domain/path/ExamApplication.exe`

If unset, fallback URL is:

- `/downloads/Pheme Secure Exam Setup 1.0.0.exe`

Set this for backend API override (optional):

- `VITE_API_BASE_URL=https://your-backend-domain`

If unset, dashboard now defaults to:

- `https://pheme-final.onrender.com`
