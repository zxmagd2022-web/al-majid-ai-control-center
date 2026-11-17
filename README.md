Security Policy
Supported Versions
Security fixes are intended for the latest maintained version of AL MAJID AI CONTROL CENTER.
If you are unsure which version is maintained, report the issue against the version you are using and include the relevant commit or release identifier when available.
Reporting a Vulnerability
Please report suspected security vulnerabilities privately to the project maintainers.
Do not publish an unpatched vulnerability in a public issue, discussion, pull request, or social media post.
Use GitHub's private vulnerability reporting feature for this repository if it is enabled.
If private vulnerability reporting is unavailable, contact the repository owner through a trusted, private channel and ask for a secure reporting method.
Do not include real customer data, passwords, OTP codes, access tokens, API secrets, private keys, or Supabase secret/service-role keys in a report.
Please include, where safe and relevant:
A concise description of the suspected vulnerability.
The affected file, component, endpoint, or feature.
The steps needed to reproduce the issue in a test environment.
The potential impact and any suggested mitigation.
The application version or commit identifier.
Do not access, modify, download, or disclose another person's data while testing. Do not perform destructive testing or denial-of-service testing against production systems.
Handling and Disclosure
The maintainers should acknowledge a report, assess its validity and impact, and coordinate a fix and responsible disclosure with the reporter.
Do not publicly disclose vulnerability details until the maintainers have had a reasonable opportunity to investigate and prepare a fix. Do not claim that a vulnerability is fixed until the change has been reviewed, tested, and released.
Security Requirements
The project must:
Keep passwords, OTP codes, API secrets, private keys, and Supabase secret/service-role keys out of source code, browser code, logs, screenshots, and public repository history.
Use only the Supabase publishable key in frontend code.
Enforce authorization on trusted server-side components and through correctly configured Supabase Row Level Security (RLS); frontend role checks and hidden interface elements are not security boundaries.
Apply authentication, session management, input validation, and rate limiting appropriate to each exposed endpoint.
Restrict employee creation, invitations, disabling, removal, and permission assignment to the director.
Restrict access to client and financial records according to explicitly granted permissions.
Require the director's explicit approval for each individual post before publication.
Verify actual receipt of payment before an advertising campaign starts; an uploaded receipt image alone is not proof of payment.
Review database policies and grants before changing data access.
Scope and Limitations
This document describes the project's security expectations and reporting process. It does not certify that the application, database, infrastructure, or deployment currently satisfies these requirements. Security controls must be verified through code review, configuration review, and testing.