# ProctorX Dashboard

This dashboard is connected to the FastAPI backend in `../backend`.

## Quick start (workspace root)

1. Install root tooling:

```sh
npm install
```

2. Install dashboard dependencies:

```sh
npm --prefix dashboard install
```

3. Install backend dependencies:

```sh
python -m pip install -r backend/requirements.txt
```

4. Configure dashboard API URL:

```sh
copy dashboard/.env.example dashboard/.env
```

5. Start backend + dashboard together:

```sh
npm run dev
```

- Dashboard: `http://localhost:8080`
- Backend API: `http://127.0.0.1:8000/api`

## Demo credentials

Seed users from backend (if not already seeded):

```sh
python backend/scripts/seed_test_users.py
```

Default password from script: `Testing123!`

- super_admin: `superadmin@pheme.testing`
- institute_admin: `instituteadmin@pheme.testing`
- faculty: `examadmin@pheme.testing`
- student: `student1@pheme.testing`
