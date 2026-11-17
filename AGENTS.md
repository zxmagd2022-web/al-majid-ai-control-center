
# AL MAJID AI CONTROL CENTER
## Repository Instructions for Codex

You are reviewing a production-oriented marketing agency management system for AL AL MAJID MARKETING AGENCY in Nigeria.

### 1. Review Before Any Changes
- Review the existing code before proposing modifications.
- Do not modify, delete, rename, or overwrite files during a code review.
- Do not commit, merge, deploy, or publish changes.
- Wait for explicit approval before implementing any proposed fix.

### 2. Critical File Protection
- Do not modify `app.js`.
- `app.js` contains a Supabase Edge Function and must not be treated as browser-side JavaScript.
- Do not replace or repurpose existing authentication or backend functions without reviewing their dependencies.
- Do not modify `index.html` without explaining the impact and obtaining approval.

### 3. Security Requirements
- Never expose, request, or commit passwords, OTP codes, API secrets, private keys, or Supabase secret keys.
- Frontend code may use only the Supabase publishable key.
- Never trust frontend-only role checks or hidden interface elements for authorization.
- Verify authorization on the server side.
- Review Supabase Row Level Security (RLS) policies and database permissions before recommending data access changes.
- Check authentication, session handling, input validation, rate limiting, and protection against unauthorized access.
- Never invent database tables, columns, RPC functions, or backend capabilities.

### 4. Management Permissions
- Only the director may create, invite, disable, or remove human employees and assign permissions.
- Employees must not grant permissions or create other employees.
- Financial access must follow explicitly assigned permissions.
- Never allow unauthorized access to client records, financial records, or agency settings.

### 5. Advertising and Publishing
- AI employees may prepare advertising content and designs.
- No post may be published to agency or client accounts without the director's explicit approval for that specific post.
- Never increase advertising budgets or modify campaigns without the required approval.
- An advertising campaign must not start until the actual payment has been verified, not merely an uploaded receipt.

### 6. Languages and Market
- The application supports Arabic, English, and Hausa.
- The primary market is Nigeria.
- Review language handling and ensure that multilingual content does not break the interface.

### 7. Review Report Format
For every review:
1. List critical security vulnerabilities.
2. List high-risk issues.
3. List medium- and low-risk issues.
4. Identify functional bugs.
5. Identify missing tests.
6. Provide file names and exact line references whenever possible.
7. Explain the impact and recommend a safe fix.

Do not report speculation as a confirmed vulnerability.
Do not claim that a feature works unless it has been verified.

### 8. Final Approval
The director must approve every code modification, database change, merge, and deployment.

The default behavior is READ-ONLY CODE REVIEW.
