# Edge functions: deployment status (as of 2026-09-20)

| Function | Deployed? | Notes |
|---|---|---|
| `notify-admin` | yes (verify_jwt on) | Emails the admin about a new shop application. Signed-in caller only; the email is built from the caller's own pending application. |
| `notify-owner` | yes (verify_jwt on) | Emails a shop owner the rejection notice. Admin only. |
| `store-reg-pending` | yes (verify_jwt on) | Saves the pending registration into an unconfirmed user's metadata. Callable without a session by necessity, so it only accepts a real, unconfirmed account created in the last 48 hours. |
| `notify` | **no** | Web-push sender (needs `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`). Written but never deployed. |
| `check-sla` | **no** | Auto-cancels late jobs and sends escalation reminders. Written but never deployed, and it needs an external scheduler (cron) that is not defined anywhere yet. |
| `printer-agent` | **no** (until migration 027 is applied) | The only door for the Windows agent (InkNeighbour Connect). **Deploy with verify_jwt off**: agents authenticate with their own per-agent credential (`Bearer <agent_id>.<secret>`, SHA-256 hash stored) or a one-time pairing code. No CORS on purpose. Never sends commands. |

The three deployed functions send mail from `inkneighbour@mail.zakapedia.in` (secrets
`RESEND_API_KEY` and `FROM_EMAIL` on the project). Browser access is limited to
`ALLOWED_ORIGINS` (default: the production site and `http://localhost:5173`).
