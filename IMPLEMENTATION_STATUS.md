# Nkwasibwe IRHCF — verified implementation status

Last reviewed: 2026-10-11

This file separates repository/CI evidence from production verification. A passing test suite does not prove that Render secrets, provider billing, database migrations, or deployed UI are healthy.

## Confirmed from source and automated checks

- The frontend API base is configured in `app.js` as `https://nkwasibwe-irhcf.onrender.com`.
- The root `package.json` test script runs syntax checks and Node.js tests under Node.js >=20.
- PR #72 added honest task progress display based on persisted backend messages, elapsed time, and a rough estimate derived from observed progress.
- PR #75 fixed the stale `chk_agent_runs_status` constraint migration so existing databases refresh the supported lifecycle statuses, including `executing`. Its Node 20/22 CI and architecture validation passed before merge.
- PR #76 added separate image, video, audio, file, and link-research routes/teams and increased the specialist-selection hard cap to eight. Its Node 20/22 CI and architecture validation passed before merge.
- PR #77 changed stale-task recovery to requeue expired `RUNNING` and `VERIFYING` tasks and close orphaned task-run, agent-step, and agent-run records. Its Node 20/22 CI and architecture validation passed before merge.
- PR #78 connected adaptive specialist budgeting to the persistent project executor. Team size now determines a bounded target of 5–8 specialist calls; the actual team size naturally limits how many can be selected. Its Node 20/22 CI and architecture validation passed before merge.
- PR #79 added explicit Kinyarwanda/English website-creation phrases so requests such as `Nkorera website yuzuye` enter the software-build route while a general question such as `What is a website?` remains normal chat. Its Node 20/22 CI and architecture validation passed before merge.
- `backend/core/task-orchestrator.js` plans and classifies work; the persistent executor in `backend/server.js` performs the long-running project execution and invokes the specialist team.

## Important limitations still requiring live verification

- The live Render `/api/health` endpoint could not be reached from the current execution environment, so production health and deployment status are **not verified** here.
- A merge into GitHub `main` does not prove that Render deployed the commit or that its database migration ran successfully.
- Image, video, music, speech, and transcription require configured provider credentials, account access, quota/billing, and real successful requests. Repository code alone cannot confirm those prerequisites.
- The eight-agent cap is a bounded upper limit, not a promise that eight agents are always available or always necessary.
- The frontend progress panel and task records should still be checked against a real deployed task from submission through verified completion and downloadable artifact delivery.

## Next engineering sequence

1. Confirm Render deploys the current `main` commit and check `GET /api/health`.
2. Submit a real authenticated long-running task and verify the database status migration, persisted progress, retry/recovery behavior, and final verified output.
3. Verify a real downloadable website artifact, then test image, audio, music, transcription, and video providers independently.
4. Test the chat/task dashboard on mobile, including attachments, progress messages, errors, and completed artifact downloads.
5. Configure only the missing providers/secrets in the hosting environment; never commit credentials.

## Reporting rule

Mark a feature production-complete only after the deployed service has been tested end-to-end and the actual output has been inspected. If a check is blocked by unavailable deployment access, network reachability, credentials, or provider quota, report that blocker explicitly.
