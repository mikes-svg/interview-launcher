# Interview Launcher

Vite + React + TypeScript SPA that runs an AI voice screening interview using the [Vapi Web SDK](https://docs.vapi.ai/sdk/web).

Candidate arrives via a personalized URL (sent from a Google Form confirmation email), passes a quick mic + camera check, then talks to the configured Vapi assistant in their browser. Audio + video recording is handled by Vapi — this app does **not** persist anything itself.

## URL parameters

| Param       | Purpose                                                    | Default     |
| ----------- | ---------------------------------------------------------- | ----------- |
| `name`      | Greeted by name; passed to Vapi as `variableValues.candidateName` | `"there"`   |
| `email`     | Sent to Vapi as `metadata.candidateEmail`                  | `""`        |
| `upworkUrl` | Sent to Vapi as `metadata.upworkUrl`                       | `""`        |
| `whatsapp`  | Sent to Vapi as `metadata.whatsapp`                        | `""`        |
| `position`  | Chooses assistant by slug (see `VITE_POSITIONS`)           | first one   |

Example: `https://your-app.vercel.app/?name=Jane&email=jane@x.com&upworkUrl=...&position=csr`

## Env vars

Copy `.env.example` to `.env.local` and fill in:

```
VITE_VAPI_PUBLIC_KEY=…
VITE_VAPI_ASSISTANT_ID=…
VITE_INTERVIEWER_NAME=Alex
VITE_COMPANY_NAME=Your Company Screening
# VITE_POSITIONS=[{"slug":"ops-manager","label":"Operations Manager","assistantId":"…"}]
```

`VITE_VAPI_PUBLIC_KEY` is the **public/web** key, not the private server key.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

1. Push to GitHub.
2. Vercel dashboard → New Project → import the repo.
3. Add the env vars above under Project Settings → Environment Variables.
4. Deploy. Subsequent pushes to `main` auto-deploy.

The `vercel.json` rewrites all paths to `index.html` so client-side routing works.

## How results reach the recruiter

This app only starts the call. When the call ends, Vapi POSTs an `end-of-call-report` to whatever **Server URL** is configured on the assistant. In the companion setup, that webhook points at a Google Apps Script (`csr-interview-apps-script/Code.gs`) that writes a row to a Google Sheet.
