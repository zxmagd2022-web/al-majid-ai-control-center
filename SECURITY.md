
# AL MAJID AI CONTROL CENTER
# Security Policy

## 1. Purpose
Protect the agency, customers, employees, financial records, and connected social media accounts.

## 2. Secrets and Credentials
- Never expose passwords, OTP codes, API secrets, private keys, or service role keys.
- Never commit secret credentials to GitHub.
- Use environment variables and secure server-side secret storage.
- Use only the Supabase publishable key in frontend code.
- If a secret is exposed, recommend immediate rotation and revocation.

## 3. Authentication
- Verify authentication securely.
- Validate sessions on the server.
- Protect against unauthorized login attempts.
- Apply rate limits to authentication and sensitive operations.
- Do not trust client-side authentication checks alone.

## 4. Authorization
- Enforce permissions on the server side.
- Only the director may create, invite, disable, or remove human employees and assign permissions.
- Employees must not grant permissions to themselves or others.
- Protect client, employee, financial, and administrative records.

## 5. Supabase and Database
- Review Row Level Security (RLS) policies.
- Deny unauthorized access by default.
- Verify database permissions and RPC authorization.
- Never invent tables, columns, policies, or RPC functions.
- Do not weaken existing security policies to make a feature work.

## 6. Financial Security
- Verify actual payment before starting an advertising campaign.
- An uploaded payment receipt is not proof of received funds.
- Restrict financial records to authorized employees.
- Maintain an auditable history of financial operations.

## 7. Social Media Publishing
- Never publish content without the director's explicit approval for each post.
- Use official platform APIs and secure credentials.
- Record approvals and publishing actions.
- Never change campaign budgets without authorization.

## 8. Code Review Rules
- Perform read-only security reviews by default.
- Do not modify or delete files without explicit approval.
- Do not modify app.js without specific approval.
- Report vulnerabilities with severity, evidence, file names, and line numbers.
- Distinguish confirmed vulnerabilities from potential risks.
- Recommend fixes without applying them automatically.

## 9. Incident Response
If a security vulnerability is discovered:
1. Explain the issue and its severity.
2. Identify affected files and systems.
3. Recommend immediate containment.
4. Explain the safest remediation.
5. Wait for director approval before making changes.

## 10. Deployment
No production deployment, merge, database migration, or security-policy change without explicit director approval.
